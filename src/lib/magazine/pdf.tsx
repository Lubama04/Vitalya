/* eslint-disable jsx-a11y/alt-text -- composant Image de @react-pdf (pas d'attribut alt dans un PDF) */
import "server-only"
import { Document, Font, Image, Link, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer"
import sharp from "sharp"
import { siteUrl } from "@/lib/env"
import { pdfText, type Block, type Run } from "@/lib/magazine/mdx-to-blocks"

// Magazine Vitalya au format PDF (A4) : couverture, sommaire paginé, articles, page finale.

// Pas de césure automatique (règles anglaises par défaut) : mots français entiers
Font.registerHyphenationCallback((word) => [word])

const VERT = "#0D6B4A"
const EMERAUDE = "#1A9E6B"
const PALE = "#D6F0E6"
const ORANGE_FONCE = "#AD5418"
const OR = "#F4B942"
const NUIT = "#1E2532"

export type MagazineArticle = {
  id: string
  title: string
  subtitle: string | null
  category: string | null
  cover: Buffer | null
  /** Contenu complet, ou résumé si l'article est réservé à une formule supérieure */
  blocks: Block[]
  locked: { summary: string; tier: string } | null
}

export type MagazineEdition = { numero: number; titre: string; label: string }

const styles = StyleSheet.create({
  page: { paddingTop: 54, paddingBottom: 64, paddingHorizontal: 56, fontFamily: "Helvetica", fontSize: 10.5, color: NUIT },
  // Interligne défini sur chaque style de texte : posé sur la page, il empêche le rendu du numéro de page ;
  // posé sur une View, il est converti en valeur absolue et double l'interligne.
  footerRule: { position: "absolute", bottom: 42, left: 56, right: 56, height: 0.5, backgroundColor: "#D1D5DB" },
  footerText: { position: "absolute", bottom: 26, fontSize: 8, color: "#6B7280" },
  category: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: ORANGE_FONCE, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 },
  title: { fontFamily: "Times-Bold", fontSize: 26, lineHeight: 1.15, color: VERT },
  subtitle: { fontFamily: "Times-Italic", fontSize: 13, color: "#4B5563", marginTop: 8, lineHeight: 1.4 },
  cover: { width: "100%", height: 230, objectFit: "cover", borderRadius: 6, marginTop: 16, marginBottom: 18 },
  rule: { width: 48, height: 3, backgroundColor: OR, marginTop: 14, marginBottom: 14 },
  h2: { fontFamily: "Times-Bold", fontSize: 16, color: VERT, marginTop: 14, marginBottom: 6 },
  h3: { fontFamily: "Helvetica-Bold", fontSize: 11.5, color: NUIT, marginTop: 10, marginBottom: 4 },
  // Taille explicite à côté de chaque interligne : le multiplicateur est calculé sur la taille du style
  paragraph: { marginBottom: 8, textAlign: "justify", fontSize: 10.5, lineHeight: 1.55 },
  lead: { fontFamily: "Times-Italic", fontSize: 13, lineHeight: 1.45, color: "#374151", marginBottom: 12 },
  listItem: { flexDirection: "row", marginBottom: 4, paddingLeft: 4 },
  bullet: { width: 14, color: EMERAUDE, fontFamily: "Helvetica-Bold" },
  quote: { borderLeftWidth: 3, borderLeftColor: OR, paddingLeft: 12, marginVertical: 10 },
  quoteText: { fontFamily: "Times-Italic", fontSize: 13, color: VERT, lineHeight: 1.4 },
  callout: { backgroundColor: PALE, borderRadius: 6, padding: 12, marginVertical: 10 },
  calloutText: { fontSize: 10.5, lineHeight: 1.5 },
  calloutTitle: { fontFamily: "Helvetica-Bold", fontSize: 9.5, color: VERT, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 },
  note: { fontSize: 9, color: "#6B7280", fontFamily: "Helvetica-Oblique", marginVertical: 6, lineHeight: 1.4 },
  table: { borderWidth: 0.5, borderColor: "#A7C9BB", borderRadius: 4, marginVertical: 10 },
  row: { flexDirection: "row" },
  cell: { flex: 1, padding: 5, fontSize: 9, lineHeight: 1.35, borderRightWidth: 0.5, borderRightColor: "#C9E2D7" },
  locked: { marginTop: 18, padding: 18, borderRadius: 8, backgroundColor: NUIT, color: "#FFFFFF" },
  listText: { flex: 1, fontSize: 10.5, lineHeight: 1.5 },
  marker: { fontSize: 1, color: "#FFFFFF", height: 1 },
})

// Type de style du PDF (celui produit par StyleSheet.create)
type PdfStyle = (typeof styles)[keyof typeof styles]

function RunsText({ runs, style }: { runs: Run[]; style?: PdfStyle }) {
  return (
    <Text style={style}>
      {runs.map((run, index) => (
        <Text
          key={index}
          style={{
            fontFamily: run.bold && run.italic ? "Helvetica-BoldOblique" : run.bold ? "Helvetica-Bold" : run.italic ? "Helvetica-Oblique" : undefined,
          }}
        >
          {run.text}
        </Text>
      ))}
    </Text>
  )
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return <Text style={block.level === 2 ? styles.h2 : styles.h3} minPresenceAhead={40}>{block.text}</Text>
    case "paragraph":
      return block.lead ? <RunsText runs={block.runs} style={styles.lead} /> : <RunsText runs={block.runs} style={styles.paragraph} />
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
          {block.author && <Text style={{ fontFamily: "Helvetica", fontSize: 9, color: "#4B5563", marginTop: 4 }}>{block.author}</Text>}
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
            <View
              key={rowIndex}
              style={[styles.row, { backgroundColor: rowIndex === 0 ? VERT : rowIndex % 2 === 0 ? PALE : "#FFFFFF" }]}
              wrap={false}
            >
              {row.map((cell, cellIndex) => (
                <Text
                  key={cellIndex}
                  style={[styles.cell, rowIndex === 0 ? { color: "#FFFFFF", fontFamily: "Helvetica-Bold" } : {}]}
                >
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

// Pied de page répété sur chaque page (éléments « fixed » positionnés sur la page)
function Footer({ edition }: { edition: MagazineEdition }) {
  return (
    <>
      <View style={styles.footerRule} fixed />
      <Text style={[styles.footerText, { left: 56 }]} fixed>
        {pdfText(`Vitalya N°${String(edition.numero).padStart(2, "0")} · ${edition.label}`)}
      </Text>
      <Text style={[styles.footerText, { right: 56, width: 80, textAlign: "right" }]} fixed render={({ pageNumber }) => `${pageNumber}`} />
    </>
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
  const numero = String(edition.numero).padStart(2, "0")
  return (
    <Document title={pdfText(edition.titre)} author="Vitalya · ETS FLAUGUST BUSINESS" subject="Magazine Vitalya" language="fr">
      {/* ─── Couverture ─── */}
      <Page size="A4" style={{ backgroundColor: VERT, color: "#FFFFFF", padding: 56, justifyContent: "space-between" }}>
        <Text style={{ fontSize: 9, letterSpacing: 3, color: PALE, textAlign: "center" }}>SANTÉ · BEAUTÉ · BIEN-ÊTRE</Text>
        <View style={{ alignItems: "center" }}>
          {emblem && <Image src={emblem} style={{ width: 170, height: 170, marginBottom: 28 }} />}
          <Text style={{ fontFamily: "Times-Bold", fontSize: 58, letterSpacing: 8 }}>VITALYA</Text>
          <View style={{ width: 80, height: 2, backgroundColor: OR, marginVertical: 18 }} />
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 20, letterSpacing: 2 }}>{pdfText(`N°${numero} · ${edition.label}`)}</Text>
          <Text style={{ fontFamily: "Times-Italic", fontSize: 18, color: OR, marginTop: 14 }}>Vivre mieux, naturellement.</Text>
        </View>
        <Text style={{ fontSize: 9, color: PALE, textAlign: "center" }}>
          {articles.length} article{articles.length > 1 ? "s" : ""} · vitalya.africa
        </Text>
      </Page>

      {/* ─── Sommaire ─── */}
      <Page size="A4" style={styles.page}>
        <Text style={{ fontFamily: "Times-Bold", fontSize: 30, color: VERT }}>Sommaire</Text>
        <View style={styles.rule} />
        {articles.map((article) => (
          <Link key={article.id} src={`#article-${article.id}`} style={{ textDecoration: "none", color: NUIT }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" }} wrap={false}>
              <View style={{ flex: 1, paddingRight: 16 }}>
                {article.category && <Text style={[styles.category, { marginBottom: 2 }]}>{pdfText(article.category)}</Text>}
                <Text style={{ fontFamily: "Times-Bold", fontSize: 13.5, lineHeight: 1.25 }}>{article.title}</Text>
                {article.locked && <Text style={{ fontSize: 8.5, color: ORANGE_FONCE, marginTop: 2 }}>Réservé aux abonnés {article.locked.tier}</Text>}
              </View>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12, color: VERT }}>{pages[article.id] ?? ""}</Text>
            </View>
          </Link>
        ))}
        <Footer edition={edition} />
      </Page>

      {/* ─── Articles ─── */}
      {articles.map((article) => (
        <Page key={article.id} size="A4" style={styles.page} id={`article-${article.id}`}>
          {/* Repère invisible : relève la page de début de l'article (sommaire) */}
          <Text render={({ pageNumber }) => (onPage(article.id, pageNumber), " ")} style={styles.marker} />
          {article.category && <Text style={styles.category}>{pdfText(article.category)}</Text>}
          <Text style={styles.title}>{article.title}</Text>
          {article.subtitle && <Text style={styles.subtitle}>{article.subtitle}</Text>}
          {article.cover ? <Image src={article.cover} style={styles.cover} /> : <View style={styles.rule} />}
          {article.locked ? (
            <>
              <Text style={styles.lead}>{article.locked.summary}</Text>
              <View style={styles.locked} wrap={false}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12, color: OR, marginBottom: 6 }}>
                  Contenu réservé aux abonnés {article.locked.tier}
                </Text>
                <Text style={{ fontSize: 10 }}>Passez à {article.locked.tier} pour accéder au contenu complet de cet article.</Text>
                <Link src={`${siteUrl}/abonnement`} style={{ fontSize: 10, color: OR, marginTop: 8 }}>
                  vitalya.africa/abonnement
                </Link>
              </View>
            </>
          ) : (
            article.blocks.map((block, index) => <BlockView key={index} block={block} />)
          )}
          <Footer edition={edition} />
        </Page>
      ))}

      {/* ─── Page finale ─── */}
      <Page size="A4" style={{ padding: 56, justifyContent: "center", alignItems: "center", color: NUIT }}>
        {logo && <Image src={logo} style={{ width: 280, height: 83 }} />}
        <Text style={{ fontFamily: "Times-Italic", fontSize: 16, color: VERT, marginTop: 26 }}>Vivre mieux, naturellement.</Text>
        <Link src={siteUrl} style={{ fontFamily: "Helvetica-Bold", fontSize: 14, color: EMERAUDE, marginTop: 14, textDecoration: "none" }}>
          vitalya.africa
        </Link>
        <Text style={{ fontSize: 8, color: "#6B7280", marginTop: 40, textAlign: "center" }}>
          © {new Date().getFullYear()} Vitalya · ETS FLAUGUST BUSINESS. Tous droits réservés.{"\n"}Les contenus de Vitalya ne remplacent pas un avis médical.
        </Text>
      </Page>
    </Document>
  )
}

/** Image distante ou du site convertie en JPEG (le PDF ne lit ni WebP ni AVIF). */
export async function loadPdfImage(url: string | null, width = 1100, keepAlpha = false): Promise<Buffer | null> {
  if (!url) return null
  const absolute = url.startsWith("http") ? url : `${siteUrl}${url}`
  try {
    const response = await fetch(absolute, { signal: AbortSignal.timeout(10000) })
    if (!response.ok) return null
    const image = sharp(Buffer.from(await response.arrayBuffer())).resize({ width, withoutEnlargement: true })
    return keepAlpha ? await image.png().toBuffer() : await image.jpeg({ quality: 78 }).toBuffer()
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
