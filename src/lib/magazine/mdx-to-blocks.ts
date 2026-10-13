import "server-only"
import remarkGfm from "remark-gfm"
import remarkMdx from "remark-mdx"
import remarkParse from "remark-parse"
import { unified } from "unified"

// Conversion du contenu MDX d'un article en blocs simples pour le PDF du magazine :
// titres, paragraphes (gras / italique), listes, citations, encadrés, tableaux.
// Les médias et éléments interactifs (vidéo, quiz, sondage, galerie…) sont omis ou signalés.

export type Run = { text: string; bold?: boolean; italic?: boolean }

export type Block =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; runs: Run[]; lead?: boolean }
  | { type: "list"; ordered: boolean; items: Run[][] }
  | { type: "quote"; text: string; author?: string }
  | { type: "callout"; title?: string; text: string }
  | { type: "table"; rows: string[][] }
  | { type: "note"; text: string }

type MdNode = {
  type: string
  value?: string
  depth?: number
  ordered?: boolean
  name?: string | null
  attributes?: { type: string; name?: string; value?: unknown }[]
  children?: MdNode[]
}

/** Caractères pris en charge par les polices standard du PDF (latin) ; le reste est retiré. */
export function pdfText(value: string): string {
  return value
    .replace(/[   ]/g, " ")
    .replace(/[‐‑]/g, "-")
    .replace(/[^\x20-\x7e -ÿŒœŸ–—‘’‚“”„•…€\n]/g, "")
    .replace(/[ \t]{2,}/g, " ")
}

function attr(node: MdNode, name: string): string | undefined {
  const found = node.attributes?.find((attribute) => attribute.type === "mdxJsxAttribute" && attribute.name === name)
  return typeof found?.value === "string" ? found.value : undefined
}

function plain(node: MdNode): string {
  if (node.type === "text" || node.type === "inlineCode") return node.value ?? ""
  if (node.type === "break") return "\n"
  return (node.children ?? []).map(plain).join("")
}

function runs(node: MdNode, style: { bold?: boolean; italic?: boolean } = {}): Run[] {
  if (node.type === "text" || node.type === "inlineCode") return [{ text: pdfText(node.value ?? ""), ...style }]
  if (node.type === "break") return [{ text: "\n", ...style }]
  if (node.type === "strong") return (node.children ?? []).flatMap((child) => runs(child, { ...style, bold: true }))
  if (node.type === "emphasis") return (node.children ?? []).flatMap((child) => runs(child, { ...style, italic: true }))
  if (node.type === "image" || node.type === "mdxJsxTextElement" && !node.children?.length) return []
  return (node.children ?? []).flatMap((child) => runs(child, style))
}

/** Texte de tous les paragraphes d'un nœud, séparés par des sauts de ligne. */
function blockText(node: MdNode): string {
  const parts: string[] = []
  const visit = (child: MdNode) => {
    if (child.type === "paragraph" || child.type === "heading") parts.push(pdfText(plain(child)).trim())
    else if (child.type === "text") parts.push(pdfText(child.value ?? "").trim())
    else child.children?.forEach(visit)
  }
  visit(node)
  return parts.filter(Boolean).join("\n")
}

// Composants éditoriaux convertis en blocs de texte
const QUOTES = new Set(["Citation", "CitationForte"])
const CALLOUTS: Record<string, string | undefined> = {
  Encart: undefined,
  Encadre: undefined,
  MiseEnAvant: undefined,
  AvisExpert: "L'avis de l'expert",
  NoteBas: undefined,
  Source: "Source",
  FicheIngredient: undefined,
}
const HEADINGS: Record<string, 2 | 3> = { TitreEditorial: 2, GrandIntertitre: 2, IntertitreElegant: 3 }
// Médias et interactions : non reproductibles sur papier
const SKIPPED = new Set(["Figure", "Galerie", "Video", "YouTube", "Infographie", "HeroSection", "MediaText", "AvantApres", "Sommaire", "ALireSuite", "BoutonCTA", "AudioLecteur"])
const INTERACTIVE = new Set(["Quiz", "Sondage"])

function convert(node: MdNode, out: Block[]) {
  switch (node.type) {
    case "heading": {
      const text = pdfText(plain(node)).trim()
      if (text) out.push({ type: "heading", level: (node.depth ?? 2) <= 2 ? 2 : 3, text })
      return
    }
    case "paragraph": {
      // Composant écrit sur une seule ligne (« <Citation>…</Citation> ») : traité comme un bloc
      const only = node.children?.length === 1 ? node.children[0] : undefined
      if (only?.type === "mdxJsxTextElement") {
        convert({ ...only, type: "mdxJsxFlowElement" }, out)
        return
      }
      const content = runs(node).filter((run) => run.text)
      if (content.some((run) => run.text.trim())) out.push({ type: "paragraph", runs: content })
      return
    }
    case "list": {
      const items = (node.children ?? [])
        .map((item) => (item.children ?? []).flatMap((child) => runs(child)).filter((run) => run.text))
        .filter((item) => item.some((run) => run.text.trim()))
      if (items.length) out.push({ type: "list", ordered: Boolean(node.ordered), items })
      return
    }
    case "blockquote": {
      const text = blockText(node)
      if (text) out.push({ type: "quote", text })
      return
    }
    case "table": {
      const rows = (node.children ?? []).map((row) => (row.children ?? []).map((cell) => pdfText(plain(cell)).trim()))
      if (rows.length) out.push({ type: "table", rows })
      return
    }
    case "mdxJsxFlowElement": {
      const name = node.name ?? ""
      if (SKIPPED.has(name)) return
      if (INTERACTIVE.has(name)) {
        out.push({ type: "note", text: `${name === "Quiz" ? "Quiz" : "Sondage"} interactif à retrouver sur vitalya.africa` })
        return
      }
      if (QUOTES.has(name)) {
        const text = blockText(node) || pdfText(attr(node, "texte") ?? "")
        if (text) out.push({ type: "quote", text, author: attr(node, "auteur") ? pdfText(attr(node, "auteur") ?? "") : undefined })
        return
      }
      if (name in CALLOUTS) {
        const text = blockText(node)
        const title = attr(node, "titre") ?? attr(node, "nom") ?? CALLOUTS[name]
        if (text || title) out.push({ type: "callout", title: title ? pdfText(title) : undefined, text })
        return
      }
      if (name in HEADINGS) {
        const text = blockText(node)
        if (text) out.push({ type: "heading", level: HEADINGS[name] ?? 2, text })
        return
      }
      if (name === "Chapeau") {
        const content = (node.children ?? []).flatMap((child) => runs(child)).filter((run) => run.text)
        if (content.length) out.push({ type: "paragraph", runs: content, lead: true })
        return
      }
      if (name === "Accordeon") {
        const question = attr(node, "question")
        if (question) out.push({ type: "heading", level: 3, text: pdfText(question) })
        node.children?.forEach((child) => convert(child, out))
        return
      }
      if (name === "Onglet" || name === "Etape") {
        const title = [attr(node, "date"), attr(node, "titre")].filter(Boolean).join(" · ")
        if (title) out.push({ type: "heading", level: 3, text: pdfText(title) })
        node.children?.forEach((child) => convert(child, out))
        return
      }
      // Autres conteneurs (Lettrine, Onglets, Timeline…) : leur contenu
      node.children?.forEach((child) => convert(child, out))
      return
    }
    default:
      node.children?.forEach((child) => convert(child, out))
  }
}

export function mdxToBlocks(source: string): Block[] {
  let tree: MdNode
  try {
    tree = unified().use(remarkParse).use(remarkGfm).use(remarkMdx).parse(source) as MdNode
  } catch {
    // Contenu non conforme MDX : lecture en Markdown simple
    tree = unified().use(remarkParse).use(remarkGfm).parse(source) as MdNode
  }
  const blocks: Block[] = []
  tree.children?.forEach((child) => convert(child, blocks))
  return blocks
}

/** Les n premiers mots des paragraphes (résumé). */
export function summary(blocks: Block[], words: number): string {
  const text = blocks
    .flatMap((block) =>
      block.type === "paragraph" ? [block.runs.map((run) => run.text).join("")] : block.type === "callout" || block.type === "quote" ? [block.text] : [],
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
  const list = text.split(" ")
  return list.length > words ? `${list.slice(0, words).join(" ")}…` : text
}
