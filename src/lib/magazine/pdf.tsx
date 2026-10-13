/* eslint-disable jsx-a11y/alt-text -- composant Image de @react-pdf (pas d'attribut alt dans un PDF) */
import "server-only"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { Document, Font, Image, Link, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer"
import sharp from "sharp"
import { siteUrl } from "@/lib/env"
import { pdfText, type Block, type Run } from "@/lib/magazine/mdx-to-blocks"

// Magazine Vitalya au format PDF (A4) : couverture, sommaire paginé, articles, page finale.

const VERT = "#0D6B4A"
const EMERAUDE = "#1A9E6B"
const PALE = "#D6F0E6"
const ORANGE = "#E8813A"
const OR = "#F4B942"
const NUIT = "#1E2532"
const GRIS = "#AAAAAA"

const A4_HEIGHT = 841.89
const MARGIN = 56

// ─── Polices : Playfair Display (titres) et Inter (texte), embarquées ; repli Times / Helvetica ───
const FONT_DIR = path.join(process.cwd(), "public", "fonts", "pdf")
const fontFile = (name: string) => path.join(FONT_DIR, name)
const EMBEDDED = ["playfair-regular.woff", "playfair-bold.woff", "playfair-italic.woff", "inter-regular.woff", "inter-bold.woff", "inter-italic.woff"].every(
  (name) => existsSync(fontFile(name)),
)
if (EMBEDDED) {
  Font.register({
    family: "Playfair",
    fonts: [
      { src: fontFile("playfair-regular.woff"), fontWeight: 400 },
      { src: fontFile("playfair-bold.woff"), fontWeight: 700 },
      { src: fontFile("playfair-italic.woff"), fontWeight: 400, fontStyle: "italic" },
    ],
  })
  Font.register({
    family: "Inter",
    fonts: [
      { src: fontFile("inter-regular.woff"), fontWeight: 400 },
      { src: fontFile("inter-bold.woff"), fontWeight: 700 },
      { src: fontFile("inter-italic.woff"), fontWeight: 400, fontStyle: "italic" },
    ],
  })
}
const SERIF = EMBEDDED ? "Playfair" : "Times-Roman"
const SANS = EMBEDDED ? "Inter" : "Helvetica"

// Pas de césure automatique (règles anglaises par défaut) : mots français entiers
Font.registerHyphenationCallback((word) => [word])

export type MagazineArticle = {
  id: string
  title: string
  subtitle: string | null
  category: string | null
  categoryColor: string
  cover: Buffer | null
  /** Contenu complet, vide si l'article est réservé à une formule supérieure */
  blocks: Block[]
  locked: { tier: string } | null
}

export type MagazineEdition = {
  numero: number
  titre: string
  /** « Avril 2026 » */
  label: string
  /** « Mai 2026 » */
  nextLabel: string
  cover: Buffer | null
  /** La couverture contient déjà logo, titre et date : rien n'est superposé */
  coverComplete: boolean
  categories: string[]
}

/** Réseaux sociaux affichés en dernière page (à compléter : { label, url }). */
const SOCIAL_LINKS: { label: string; url: string }[] = []

// Interligne : toujours sur un style de texte avec sa taille (sur la page, il empêche le rendu
// des numéros de page ; sur une View, il est converti en valeur absolue).
const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 64, paddingHorizontal: MARGIN, fontFamily: SANS, fontSize: 11, color: NUIT },
  footerText: { position: "absolute", bottom: 26, left: MARGIN, fontSize: 7.5, color: GRIS },
  pageNumber: { position: "absolute", bottom: 26, left: 0, right: 0, textAlign: "center", fontSize: 8, color: GRIS },
  marker: { fontSize: 1, color: "#FFFFFF", height: 1 },
  articleHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  articleCategory: { fontFamily: SANS, fontWeight: 700, fontSize: 8.5, letterSpacing: 1.6, textTransform: "uppercase" },
  articleNumber: { fontFamily: SANS, fontSize: 8, color: GRIS, letterSpacing: 1 },
  cover: { width: "100%", height: A4_HEIGHT * 0.4, objectFit: "cover", borderRadius: 4, marginBottom: 18 },
  title: { fontFamily: SERIF, fontWeight: 700, fontSize: 24, lineHeight: 1.2, color: VERT },
  subtitle: { fontFamily: SERIF, fontStyle: "italic", fontSize: 14, lineHeight: 1.4, color: "#4B5563", marginTop: 8 },
  separator: { width: 56, height: 3, backgroundColor: ORANGE, marginTop: 14, marginBottom: 16 },
  h2: { fontFamily: SERIF, fontWeight: 700, fontSize: 15, lineHeight: 1.3, color: VERT, marginTop: 14, marginBottom: 6 },
  h3: { fontFamily: SANS, fontWeight: 700, fontSize: 11.5, lineHeight: 1.4, color: NUIT, marginTop: 10, marginBottom: 4 },
  paragraph: { fontFamily: SANS, fontSize: 11, lineHeight: 1.6, marginBottom: 8, textAlign: "justify" },
  lead: { fontFamily: SERIF, fontStyle: "italic", fontSize: 13, lineHeight: 1.5, color: "#374151", marginBottom: 12 },
  listItem: { flexDirection: "row", marginBottom: 4, paddingLeft: 4 },
  bullet: { width: 16, fontFamily: SANS, fontWeight: 700, fontSize: 11, lineHeight: 1.6, color: EMERAUDE },
  listText: { flex: 1, fontFamily: SANS, fontSize: 11, lineHeight: 1.6 },
  quote: { borderLeftWidth: 3, borderLeftColor: OR, paddingLeft: 12, marginVertical: 10 },
  quoteText: { fontFamily: SERIF, fontStyle: "italic", fontSize: 13, lineHeight: 1.45, color: VERT },
  quoteAuthor: { fontFamily: SANS, fontSize: 9, lineHeight: 1.4, color: "#4B5563", marginTop: 4 },
  callout: { backgroundColor: PALE, borderRadius: 6, padding: 12, marginVertical: 10 },
  calloutTitle: { fontFamily: SANS, fontWeight: 700, fontSize: 8.5, lineHeight: 1.4, color: VERT, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 },
  calloutText: { fontFamily: SANS, fontSize: 10.5, lineHeight: 1.55 },
  note: { fontFamily: SANS, fontStyle: "italic", fontSize: 9, lineHeight: 1.4, color: "#6B7280", marginVertical: 6 },
  table: { borderWidth: 0.5, borderColor: "#A7C9BB", borderRadius: 4, marginVertical: 10 },
  row: { flexDirection: "row" },
  cell: { flex: 1, padding: 5, fontFamily: SANS, fontSize: 9, lineHeight: 1.35, borderRightWidth: 0.5, borderRightColor: "#C9E2D7" },
})

type PdfStyle = (typeof styles)[keyof typeof styles]

function RunsText({ runs, style }: { runs: Run[]; style?: PdfStyle }) {
  return (
    <Text style={style}>
      {runs.map((run, index) => (
        <Text key={index} style={{ fontWeight: run.bold ? 700 : 400, fontStyle: run.italic ? "italic" : "normal" }}>
          {run.text}
        </Text>
      ))}
    </Text>
  )
}

/** Composants MDX rendus en style simplifié (titres, encadrés, citations, listes, tableaux). */
function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return (
        <Text style={block.level === 2 ? styles.h2 : styles.h3} minPresenceAhead={40}>
          {block.text}
        </Text>
      )
    case "paragraph":
      return <RunsText runs={block.runs} style={block.lead ? styles.lead : styles.paragraph} />
    case "list":
      return (
        <View style={{ marginBottom: 8 }}>
          {block.items.map((item, index) => (
            <View key={index} style={styles.listItem} wrap={false}>
              <Text style={styles.bullet}>{block.ordered ? `${index + 1}.` : "•"}</Text>
              <RunsText runs={item} style={styles.listText} />
            </View>
          ))}
        </View>
      )
    case "quote":
      return (
        <View style={styles.quote} wrap={false}>
          <Text style={styles.quoteText}>« {block.text} »</Text>
          {block.author && <Text style={styles.quoteAuthor}>{block.author}</Text>}
        </View>
      )
    case "callout":
      return (
        <View style={styles.callout} wrap={false}>
          {block.title && <Text style={styles.calloutTitle}>{block.title}</Text>}
          {block.text && <Text style={styles.calloutText}>{block.text}</Text>}
        </View>
      )
    case "table":
      return (
        <View style={styles.table}>
          {block.rows.map((row, rowIndex) => (
            <View key={rowIndex} style={[styles.row, { backgroundColor: rowIndex === 0 ? VERT : rowIndex % 2 === 0 ? PALE : "#FFFFFF" }]} wrap={false}>
              {row.map((cell, cellIndex) => (
                <Text key={cellIndex} style={[styles.cell, rowIndex === 0 ? { color: "#FFFFFF", fontWeight: 700 } : {}]}>
                  {cell}
                </Text>
              ))}
            </View>
          ))}
        </View>
      )
    case "note":
      return <Text style={styles.note}>{block.text}</Text>
  }
}

/** Pied de page des pages intérieures : mention (ou logo) à gauche, numéro centré gris. */
function Footer({ emblem }: { emblem?: Buffer | null }) {
  return (
    <>
      {emblem ? (
        <Image src={emblem} style={{ position: "absolute", bottom: 20, left: MARGIN, width: 18, height: 18 }} fixed />
      ) : (
        <Text style={styles.footerText} fixed>
          Vitalya · vitalya.africa
        </Text>
      )}
      <Text style={styles.pageNumber} fixed render={({ pageNumber }) => `${pageNumber}`} />
    </>
  )
}

function Cover({ edition, emblem }: { edition: MagazineEdition; emblem: Buffer | null }) {
  const numero = String(edition.numero).padStart(2, "0")
  // Couverture déjà composée (maquette Canva) : pleine page, sans superposition
  if (edition.cover && edition.coverComplete) {
    return (
      <Page size="A4" style={{ padding: 0 }}>
        <Image src={edition.cover} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </Page>
    )
  }
  return (
    <Page size="A4" style={{ padding: 0, backgroundColor: VERT, color: "#FFFFFF" }}>
      {edition.cover && <Image src={edition.cover} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
      {/* Voile pour la lisibilité du texte sur photo */}
      {edition.cover && <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(13,107,74,0.55)" }} />}
      <View style={{ flex: 1, padding: MARGIN, justifyContent: "space-between" }}>
        <View style={{ alignItems: "center" }}>
          {emblem && <Image src={emblem} style={{ width: 96, height: 96, marginBottom: 14 }} />}
          <Text style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 40, letterSpacing: 8, color: "#FFFFFF" }}>VITALYA</Text>
          <Text style={{ fontFamily: SANS, fontSize: 8.5, letterSpacing: 3, color: PALE, marginTop: 6 }}>SANTÉ · BEAUTÉ · BIEN-ÊTRE</Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 96, color: "#FFFFFF" }}>N°{numero}</Text>
          <View style={{ width: 80, height: 3, backgroundColor: ORANGE, marginVertical: 14 }} />
          <Text style={{ fontFamily: SANS, fontWeight: 700, fontSize: 18, letterSpacing: 2 }}>{pdfText(edition.label)}</Text>
          <Text style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 20, color: OR, marginTop: 18 }}>Vivre mieux, naturellement.</Text>
        </View>
        <View style={{ alignItems: "center" }}>
          {edition.categories.length > 0 && (
            <Text style={{ fontFamily: SANS, fontSize: 9, letterSpacing: 1.5, color: PALE, textAlign: "center" }}>
              {edition.categories.map((category) => pdfText(category).toUpperCase().replace(/ /g, " ")).join("  ·  ")}
            </Text>
          )}
          <Text style={{ fontFamily: SANS, fontSize: 8.5, color: PALE, marginTop: 8 }}>vitalya.africa</Text>
        </View>
      </View>
    </Page>
  )
}

function MagazineDocument({
  edition,
  articles,
  emblem,
  logo,
  pages,
  onPage,
}: {
  edition: MagazineEdition
  articles: MagazineArticle[]
  emblem: Buffer | null
  logo: Buffer | null
  /** Page de début de chaque article (2e rendu) */
  pages: Record<string, number>
  /** Relevé des pages (1er rendu) */
  onPage: (id: string, page: number) => void
}) {
  return (
    <Document title={pdfText(edition.titre)} author="Vitalya · ETS FLAUGUST BUSINESS" subject="Magazine Vitalya" language="fr">
      <Cover edition={edition} emblem={emblem} />

      {/* ─── Sommaire ─── */}
      <Page size="A4" style={styles.page}>
        <Text style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 34, color: VERT }}>Sommaire</Text>
        <Text style={{ fontFamily: SANS, fontSize: 9, color: "#6B7280", marginTop: 4 }}>{pdfText(edition.titre)}</Text>
        <View style={{ width: 56, height: 3, backgroundColor: ORANGE, marginTop: 14, marginBottom: 18 }} />
        {articles.map((article, index) => (
          <Link key={article.id} src={`#article-${article.id}`} style={{ textDecoration: "none", color: NUIT }}>
            <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" }} wrap={false}>
              <Text style={{ width: 38, fontFamily: SERIF, fontWeight: 700, fontSize: 20, color: EMERAUDE }}>{String(index + 1).padStart(2, "0")}</Text>
              <View style={{ flex: 1, paddingRight: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                  {article.category && (
                    <Text style={{ fontFamily: SANS, fontWeight: 700, fontSize: 7.5, letterSpacing: 1.4, color: article.categoryColor, textTransform: "uppercase" }}>
                      {pdfText(article.category)}
                    </Text>
                  )}
                  {article.locked && (
                    <Text style={{ fontFamily: SANS, fontWeight: 700, fontSize: 6.5, color: OR, backgroundColor: NUIT, paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 6, marginLeft: 6 }}>
                      {article.locked.tier.toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{article.title}</Text>
              </View>
              <Text style={{ fontFamily: SANS, fontWeight: 700, fontSize: 12, color: VERT }}>{pages[article.id] ?? ""}</Text>
            </View>
          </Link>
        ))}
        <Footer emblem={emblem} />
      </Page>

      {/* ─── Articles ─── */}
      {articles.map((article, index) => (
        <Page key={article.id} size="A4" style={styles.page} id={`article-${article.id}`}>
          {/* Repère invisible : relève la page de début de l'article (sommaire) */}
          <Text render={({ pageNumber }) => (onPage(article.id, pageNumber), " ")} style={styles.marker} />
          <View style={styles.articleHeader}>
            <Text style={[styles.articleCategory, { color: article.categoryColor }]}>{article.category ? pdfText(article.category) : "Vitalya"}</Text>
            <Text style={styles.articleNumber}>ARTICLE {String(index + 1).padStart(2, "0")}</Text>
          </View>
          {article.cover && <Image src={article.cover} style={styles.cover} />}
          <Text style={styles.title}>{article.title}</Text>
          {article.subtitle && <Text style={styles.subtitle}>{article.subtitle}</Text>}
          <View style={styles.separator} />
          {article.locked ? (
            <View style={{ alignItems: "center", marginTop: 8 }} wrap={false}>
              <View style={{ width: "86%", backgroundColor: VERT, borderRadius: 10, padding: 22, alignItems: "center" }}>
                <Text style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 15, color: "#FFFFFF", textAlign: "center", lineHeight: 1.35 }}>
                  Ce contenu est réservé aux abonnés {article.locked.tier}.
                </Text>
                <Text style={{ fontFamily: SANS, fontSize: 10.5, lineHeight: 1.55, color: PALE, textAlign: "center", marginTop: 8 }}>
                  Passez à l&apos;abonnement {article.locked.tier} pour accéder à cet article et à toutes les analyses de nos spécialistes.
                </Text>
                <Link
                  src={`${siteUrl}/abonnement`}
                  style={{ marginTop: 14, backgroundColor: ORANGE, color: NUIT, fontFamily: SANS, fontWeight: 700, fontSize: 10.5, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, textDecoration: "none" }}
                >
                  vitalya.africa/abonnement
                </Link>
              </View>
            </View>
          ) : (
            article.blocks.map((block, blockIndex) => <BlockView key={blockIndex} block={block} />)
          )}
          <Footer />
        </Page>
      ))}

      {/* ─── Page finale ─── */}
      <Page size="A4" style={{ padding: MARGIN, justifyContent: "center", alignItems: "center", color: NUIT, fontFamily: SANS }}>
        {logo && <Image src={logo} style={{ width: 280, height: 83 }} />}
        <Text style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 26, color: VERT, marginTop: 34 }}>Merci de nous lire</Text>
        <Text style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 14, color: "#4B5563", marginTop: 8 }}>Vivre mieux, naturellement.</Text>
        <View style={{ width: 56, height: 3, backgroundColor: ORANGE, marginVertical: 22 }} />
        <Text style={{ fontSize: 12, color: NUIT }}>Prochain numéro : {pdfText(edition.nextLabel)}</Text>
        <Link src={siteUrl} style={{ fontWeight: 700, fontSize: 15, color: EMERAUDE, marginTop: 14, textDecoration: "none" }}>
          vitalya.africa
        </Link>
        {SOCIAL_LINKS.length > 0 ? (
          <View style={{ flexDirection: "row", marginTop: 12 }}>
            {SOCIAL_LINKS.map((social) => (
              <Link key={social.url} src={social.url} style={{ fontSize: 10, color: VERT, marginHorizontal: 8, textDecoration: "none" }}>
                {social.label}
              </Link>
            ))}
          </View>
        ) : (
          <Text style={{ fontSize: 10, color: "#6B7280", marginTop: 12 }}>Suivez Vitalya sur les réseaux sociaux</Text>
        )}
        <Text style={{ fontSize: 7.5, color: GRIS, marginTop: 46, textAlign: "center" }}>
          © {new Date().getFullYear()} Vitalya · ETS FLAUGUST BUSINESS. Tous droits réservés.{"\n"}Les contenus de Vitalya ne remplacent pas un avis médical.
        </Text>
      </Page>
    </Document>
  )
}

/**
 * Image convertie en JPEG / PNG (le PDF ne lit ni WebP ni AVIF).
 * Fichiers du site lus sur disque quand c'est possible, sinon téléchargés.
 */
export async function loadPdfImage(url: string | null, width = 1100, keepAlpha = false): Promise<Buffer | null> {
  if (!url) return null
  try {
    let input: Buffer | null = null
    if (url.startsWith("/") && !url.startsWith("//")) {
      const publicDir = path.join(process.cwd(), "public")
      const local = path.join(publicDir, url.split("?")[0] ?? url)
      if (local.startsWith(publicDir) && existsSync(local)) input = await readFile(local)
    }
    if (!input) {
      const response = await fetch(url.startsWith("http") ? url : `${siteUrl}${url}`, { signal: AbortSignal.timeout(10000) })
      if (!response.ok) return null
      input = Buffer.from(await response.arrayBuffer())
    }
    const image = sharp(input).resize({ width, withoutEnlargement: true })
    return keepAlpha ? await image.png().toBuffer() : await image.jpeg({ quality: 80 }).toBuffer()
  } catch {
    return null
  }
}

export async function renderMagazinePdf(edition: MagazineEdition, articles: MagazineArticle[]): Promise<Buffer> {
  const [emblem, logo] = await Promise.all([loadPdfImage("/brand/emblem.png", 400, true), loadPdfImage("/brand/logo.png", 700, true)])

  // 1er rendu : relevé de la page de début de chaque article ; 2e rendu : sommaire paginé
  const pages: Record<string, number> = {}
  const record = (id: string, page: number) => {
    if (!pages[id] || page < pages[id]) pages[id] = page
  }
  await renderToBuffer(<MagazineDocument edition={edition} articles={articles} emblem={emblem} logo={logo} pages={{}} onPage={record} />)
  return renderToBuffer(<MagazineDocument edition={edition} articles={articles} emblem={emblem} logo={logo} pages={pages} onPage={() => undefined} />)
}
