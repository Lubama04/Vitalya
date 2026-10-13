import "server-only"
import { accentOnWhite, type AccessLevel, isAccessLevel, tierRank } from "@/lib/constants"
import { loadPdfImage, type MagazineArticle, type MagazineEdition } from "@/lib/magazine/pdf"
import { mdxToBlocks, pdfText } from "@/lib/magazine/mdx-to-blocks"
import { createPublicClient } from "@/lib/supabase/public"
import type { createClient } from "@/lib/supabase/server"

export type Edition = {
  id: string
  numero: number
  titre: string
  datePublication: string
  articleIds: string[]
  couvertureUrl: string | null
  couverturePdfUrl: string | null
  couvertureComplete: boolean
  updatedAt: string
}

export const EDITION_COLUMNS = "id, numero, titre, date_publication, article_ids, couverture_url, couverture_pdf_url, couverture_complete, updated_at"

export type EditionRow = {
  id: string
  numero: number
  titre: string
  date_publication: string
  article_ids: string[]
  couverture_url: string | null
  couverture_pdf_url: string | null
  couverture_complete: boolean
  updated_at: string
}

export const toEdition = (row: EditionRow): Edition => ({
  id: row.id,
  numero: row.numero,
  titre: row.titre,
  datePublication: row.date_publication,
  articleIds: row.article_ids,
  couvertureUrl: row.couverture_url,
  couverturePdfUrl: row.couverture_pdf_url,
  couvertureComplete: row.couverture_complete,
  updatedAt: row.updated_at,
})

export async function getEditions(): Promise<Edition[]> {
  const { data } = await createPublicClient().from("magazine_editions").select(EDITION_COLUMNS).order("numero", { ascending: false })
  return (data ?? []).map(toEdition)
}

export async function getEdition(numero: number): Promise<Edition | null> {
  const { data } = await createPublicClient().from("magazine_editions").select(EDITION_COLUMNS).eq("numero", numero).maybeSingle()
  return data ? toEdition(data) : null
}

function monthLabel(date: Date): string {
  const label = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Libellé de date du numéro : « Avril 2026 ». */
export function editionLabel(edition: Edition): string {
  return monthLabel(new Date(edition.datePublication))
}

/** Mois du numéro suivant (parution mensuelle) : « Mai 2026 ». */
export function nextEditionLabel(edition: Edition): string {
  const date = new Date(edition.datePublication)
  return monthLabel(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)))
}

/** Formule minimale pour télécharger le magazine. */
export const MAGAZINE_MIN_TIER: AccessLevel = "premium"

export function canDownloadMagazine(tier: AccessLevel, isStaff: boolean): boolean {
  return isStaff || tierRank(tier) >= tierRank(MAGAZINE_MIN_TIER)
}

const TIER_NAMES: Record<AccessLevel, string> = { free: "Gratuit", premium: "Premium", expert: "Expert" }

type ArticleRow = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  cover_image: string | null
  access_level: string
  category: { name: string; color: string } | null
}

/**
 * Articles du numéro tels que le lecteur peut les lire : le contenu passe par get_article_body
 * (paywall en base). Un article d'une formule supérieure n'apparaît qu'avec titre, sous-titre,
 * couverture et l'encart « réservé ». Les articles non publiés n'apparaissent pas (sauf pour l'équipe).
 */
export async function buildMagazineArticles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  edition: Edition,
  tier: AccessLevel,
  isStaff: boolean,
): Promise<MagazineArticle[]> {
  if (edition.articleIds.length === 0) return []
  const { data: rows } = await supabase
    .from("articles")
    .select("id, slug, title, subtitle, cover_image, access_level, category:categories(name, color)")
    .in("id", edition.articleIds)
    .overrideTypes<ArticleRow[], { merge: false }>()

  const byId = new Map((rows ?? []).map((row) => [row.id, row]))
  const ordered = edition.articleIds.map((id) => byId.get(id)).filter((row): row is ArticleRow => Boolean(row))

  const built = await Promise.all(
    ordered.map(async (row): Promise<MagazineArticle | null> => {
      const level: AccessLevel = isAccessLevel(row.access_level) ? row.access_level : "free"
      const [{ data: body }, cover] = await Promise.all([
        supabase.rpc("get_article_body", { p_slug: row.slug }).maybeSingle(),
        loadPdfImage(row.cover_image),
      ])
      if (!body) return null
      const unlocked = isStaff || (body.has_access && tierRank(tier) >= tierRank(level))
      return {
        id: row.id,
        title: pdfText(row.title),
        subtitle: row.subtitle ? pdfText(row.subtitle) : null,
        category: row.category?.name ?? null,
        categoryColor: accentOnWhite(row.category?.color ?? "#0D6B4A"),
        cover,
        blocks: unlocked ? mdxToBlocks(body.content) : [],
        locked: unlocked ? null : { tier: TIER_NAMES[level] },
      }
    }),
  )
  return built.filter((article): article is MagazineArticle => article !== null)
}

/** Données du numéro pour le PDF : couverture (PDF dédiée sinon web), libellés, rubriques. */
export async function buildMagazineEdition(edition: Edition, articles: MagazineArticle[]): Promise<MagazineEdition> {
  const cover = await loadPdfImage(edition.couverturePdfUrl ?? edition.couvertureUrl, 1400)
  return {
    numero: edition.numero,
    titre: edition.titre,
    label: editionLabel(edition),
    nextLabel: nextEditionLabel(edition),
    cover,
    coverComplete: edition.couvertureComplete,
    categories: [...new Set(articles.map((article) => article.category).filter((name): name is string => Boolean(name)))],
  }
}
