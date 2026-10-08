import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { compileMDX } from "next-mdx-remote/rsc"
import { ALireSuite, type MdxArticleContext } from "@/components/mdx/a-lire-suite"
import { AvantApres } from "@/components/mdx/avant-apres"
import {
  ARetenir,
  AvisExpert,
  Avertissement,
  BoutonCTA,
  Chapeau,
  Citation,
  Encadre,
  Encart,
  Lettrine,
  MythesRealites,
  NiveauPreuve,
  Ref,
  SommaireView,
  Source,
  Separateur,
  type TocHeading,
} from "@/components/mdx/editorial"
import { Figure, Galerie, HeroSection, Infographie, MediaText, SafeImage, Video, YouTube } from "@/components/mdx/media"
import { Accordeon, Etape, Onglet, Onglets, Timeline } from "@/components/mdx/interactive"
import { AudioLecteur, Question, Quiz, Reponse, Sondage, SondageOption } from "@/components/mdx/engagement"
import { FicheIngredient } from "@/components/mdx/cards"
import {
  CitationForte,
  Couleur,
  GrandIntertitre,
  IntertitreElegant,
  Legende,
  MiseEnAvant,
  NoteBas,
  TitreEditorial,
} from "@/components/mdx/typography"
import { headingId, isExternalHref, isSafeHref } from "@/lib/mdx/urls"

// ═══════════════════════════════════════════════════════════════
// LISTE BLANCHE MDX
// Seuls ces composants et ces attributs survivent à la compilation.
// Tout le reste (balises HTML brutes, <script>, <iframe>, attributs
// d'événement, imports/exports, expressions JS) est supprimé.
// ═══════════════════════════════════════════════════════════════
export const MDX_ALLOWLIST: Record<string, readonly string[]> = {
  // Texte et styles typographiques
  Chapeau: ["police", "couleur"],
  Lettrine: [],
  Citation: ["auteur", "fonction"],
  TitreEditorial: ["surtitre", "police", "couleur"],
  GrandIntertitre: ["police", "couleur"],
  IntertitreElegant: ["police", "couleur"],
  CitationForte: ["auteur", "police", "couleur"],
  MiseEnAvant: ["police", "couleur"],
  Legende: ["couleur"],
  NoteBas: ["couleur"],
  Couleur: ["valeur"],
  // Interactif
  Accordeon: ["question", "ouvert"],
  Onglets: [],
  Onglet: ["titre"],
  Timeline: ["titre"],
  Etape: ["date", "titre"],
  Quiz: ["titre"],
  Question: ["texte"],
  Reponse: ["correcte", "explication"],
  Sondage: ["question"],
  Option: [],
  Audio: ["src", "titre"],
  FicheIngredient: [
    "nom",
    "nomScientifique",
    "origine",
    "partieUtilisee",
    "utilisationsTraditionnelles",
    "niveauPreuve",
    "precautions",
  ],
  // Information
  Encart: ["titre"],
  ARetenir: ["titre"],
  Avertissement: ["niveau", "titre"],
  MythesRealites: ["mythe", "realite"],
  NiveauPreuve: ["note", "libelle"],
  // Science
  Source: ["n", "url"],
  Ref: ["n"],
  AvisExpert: ["nom", "profession", "institution", "photo"],
  // Médias
  Figure: ["src", "alt", "legende", "credit", "taille"],
  Infographie: ["src", "alt", "legende", "credit"],
  Galerie: ["images", "legende"],
  AvantApres: ["avant", "apres", "legende"],
  Video: ["src", "poster", "titre"],
  YouTube: ["videoId", "titre"],
  // Mise en page
  MediaText: ["src", "alt", "variante", "legende"],
  HeroSection: ["src", "titre", "sousTitre"],
  Separateur: ["style"],
  Encadre: ["titre", "couleur"],
  // Navigation
  Sommaire: ["titre"],
  ALireSuite: ["titre"],
  BoutonCTA: ["href", "texte", "variante"],
}

type MdAttribute = {
  type: string
  name?: string
  value?: string | null | { type: string; value?: string }
}
type MdNode = {
  type: string
  name?: string | null
  depth?: number
  value?: string
  attributes?: MdAttribute[]
  children?: MdNode[]
  data?: { hProperties?: Record<string, unknown> }
}

const FORBIDDEN_TYPES = new Set(["mdxjsEsm", "mdxFlowExpression", "mdxTextExpression", "html"])

/**
 * Convertit un attribut autorisé en chaîne. Les expressions ne sont jamais
 * exécutées : seules les valeurs littérales JSON ({3}, {["…"]}) sont acceptées.
 */
function toStringValue(attribute: MdAttribute): string | null {
  const { value } = attribute
  if (typeof value === "string") return value
  if (value && typeof value === "object" && value.type === "mdxJsxAttributeValueExpression" && typeof value.value === "string") {
    try {
      const parsed: unknown = JSON.parse(value.value.trim())
      if (typeof parsed === "string") return parsed
      if (typeof parsed === "number" || typeof parsed === "boolean") return String(parsed)
      if (Array.isArray(parsed) || (parsed !== null && typeof parsed === "object")) return JSON.stringify(parsed)
    } catch {
      return null
    }
  }
  return null
}

// Seuls ces composants peuvent vivre au milieu d'une phrase
const INLINE_COMPONENTS = new Set(["Ref", "Couleur"])

/**
 * Un composant de bloc écrit au milieu d'un paragraphe (<p>…<Encart/>…</p>)
 * produirait un HTML invalide : on scinde le paragraphe autour de lui.
 */
function hoistBlockComponents(children: MdNode[]): MdNode[] {
  return children.flatMap((child): MdNode[] => {
    if (child.type !== "paragraph" || !child.children?.some(isInlineBlock)) return [child]
    const result: MdNode[] = []
    let buffer: MdNode[] = []
    const flush = () => {
      if (buffer.some((node) => node.type !== "text" || (node.value ?? "").trim())) {
        result.push({ type: "paragraph", children: buffer })
      }
      buffer = []
    }
    for (const node of child.children) {
      if (isInlineBlock(node)) {
        flush()
        result.push({ ...node, type: "mdxJsxFlowElement" })
      } else {
        buffer.push(node)
      }
    }
    flush()
    return result
  })
}

function isInlineBlock(node: MdNode): boolean {
  return node.type === "mdxJsxTextElement" && Boolean(node.name) && !INLINE_COMPONENTS.has(node.name ?? "")
}

function sanitizeTree(node: MdNode): void {
  if (!node.children) return
  node.children = hoistBlockComponents(node.children).filter((child) => {
    if (FORBIDDEN_TYPES.has(child.type)) return false
    if (child.type === "mdxJsxFlowElement" || child.type === "mdxJsxTextElement") {
      const allowed = child.name ? MDX_ALLOWLIST[child.name] : undefined
      if (!allowed) return false
      child.attributes = (child.attributes ?? []).flatMap((attribute): MdAttribute[] => {
        if (attribute.type !== "mdxJsxAttribute" || !attribute.name || !allowed.includes(attribute.name)) return []
        const value = toStringValue(attribute)
        return value === null ? [] : [{ type: "mdxJsxAttribute", name: attribute.name, value: value.slice(0, 5000) }]
      })
    }
    return true
  })
  node.children.forEach(sanitizeTree)
}

function remarkAllowlist() {
  return (tree: MdNode) => sanitizeTree(tree)
}

function textOf(node: MdNode): string {
  if (typeof node.value === "string" && (node.type === "text" || node.type === "inlineCode")) return node.value
  return (node.children ?? []).map(textOf).join("")
}

// Composants de titre : rendus en h2 / h3, ils entrent dans le sommaire
const HEADING_COMPONENTS: Record<string, 2 | 3> = { TitreEditorial: 2, GrandIntertitre: 2, IntertitreElegant: 3 }

/** Ajoute une ancre aux intertitres H2/H3 (Markdown et composants) et alimente le sommaire. */
function remarkHeadings(headings: TocHeading[]) {
  return () => (tree: MdNode) => {
    const used = new Map<string, number>()
    const visit = (node: MdNode) => {
      if (node.type === "heading" && (node.depth === 2 || node.depth === 3)) {
        const text = textOf(node).trim()
        const id = headingId(text, used)
        node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id } }
        headings.push({ id, text, depth: node.depth })
      }
      const componentDepth = node.type === "mdxJsxFlowElement" && node.name ? HEADING_COMPONENTS[node.name] : undefined
      if (componentDepth) {
        const text = textOf(node).trim()
        const id = headingId(text, used)
        // Attribut interne ajouté après la liste blanche : identifiant calculé, jamais saisi
        node.attributes = [...(node.attributes ?? []), { type: "mdxJsxAttribute", name: "id", value: id }]
        headings.push({ id, text, depth: componentDepth })
      }
      node.children?.forEach(visit)
    }
    visit(tree)
  }
}

/** Liens : seuls http(s), mailto, chemins internes et ancres sont cliquables. */
function SafeLink({ href, children, ...rest }: ComponentPropsWithoutRef<"a">) {
  if (!isSafeHref(href)) return <span>{children}</span>
  return (
    <a {...rest} href={href} {...(isExternalHref(href) ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}>
      {children}
    </a>
  )
}

export async function MdxContent({
  source,
  context = {},
  preview = false,
}: {
  source: string
  context?: MdxArticleContext
  /** Aperçu éditeur : affiche le détail des erreurs de syntaxe */
  preview?: boolean
}) {
  const headings: TocHeading[] = []

  const components = {
    Chapeau,
    Lettrine,
    Citation,
    TitreEditorial,
    GrandIntertitre,
    IntertitreElegant,
    CitationForte,
    MiseEnAvant,
    Legende,
    NoteBas,
    Couleur,
    Accordeon,
    Onglets,
    Onglet,
    Timeline,
    Etape,
    Quiz,
    Question,
    Reponse,
    // Le sondage a besoin de l'article pour enregistrer les votes
    Sondage: ({ question, children }: { question?: string; children?: ReactNode }) => (
      <Sondage question={question} articleId={context.articleId}>
        {children}
      </Sondage>
    ),
    Option: SondageOption,
    Audio: AudioLecteur,
    FicheIngredient,
    Encart,
    ARetenir,
    Avertissement,
    MythesRealites,
    NiveauPreuve,
    Source,
    Ref,
    AvisExpert,
    Figure,
    Infographie,
    Galerie,
    AvantApres,
    Video,
    YouTube,
    MediaText,
    HeroSection,
    Separateur,
    Encadre,
    BoutonCTA,
    // Le sommaire lit les intertitres collectés pendant la compilation
    Sommaire: ({ titre }: { titre?: string }) => <SommaireView headings={headings} titre={titre} />,
    ALireSuite: ({ titre }: { titre?: string }) => <ALireSuite titre={titre} context={context} />,
    a: SafeLink,
    img: SafeImage,
  }

  try {
    const { content } = await compileMDX({
      source,
      components,
      options: {
        // blockJS reste actif en seconde barrière après notre liste blanche
        blockJS: true,
        blockDangerousJS: true,
        mdxOptions: { remarkPlugins: [remarkAllowlist, remarkHeadings(headings)] },
      },
    })
    return content
  } catch (error) {
    // MDX invalide : texte brut plutôt qu'une page cassée
    const message = error instanceof Error ? error.message : String(error)
    console.error("MDX compile error", message)
    return (
      <div>
        {preview && (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
            Erreur de syntaxe MDX : {message.split("\n")[0]}
          </p>
        )}
        <div className="mt-4 whitespace-pre-line">{source}</div>
      </div>
    )
  }
}
