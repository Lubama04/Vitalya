import "server-only"
import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { isAccessLevel, type AccessLevel } from "@/lib/constants"
import type { Tables } from "@/types/database"

export type Category = Pick<Tables<"categories">, "id" | "name" | "slug" | "description" | "color">

export type ArticleSummary = {
  id: string
  title: string
  subtitle: string | null
  slug: string
  coverImage: string | null
  accessLevel: AccessLevel
  publishedAt: string | null
  readingTime: number
  category: Category | null
}

// Colonnes lisibles (le contenu est exclu : privilège de colonne en base)
const SUMMARY_COLUMNS =
  "id, title, subtitle, slug, cover_image, access_level, published_at, reading_time, category:categories(id, name, slug, description, color)"

type SummaryRow = {
  id: string
  title: string
  subtitle: string | null
  slug: string
  cover_image: string | null
  access_level: string
  published_at: string | null
  reading_time: number
  category: Category | null
}

function toSummary(row: SummaryRow): ArticleSummary {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    slug: row.slug,
    coverImage: row.cover_image,
    accessLevel: isAccessLevel(row.access_level) ? row.access_level : "free",
    publishedAt: row.published_at,
    readingTime: row.reading_time,
    category: row.category,
  }
}

export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, description, color")
    .order("position", { ascending: true })
  if (error) {
    console.error("getCategories", error.message)
    return []
  }
  return data
})

export const getCategoryBySlug = cache(async (slug: string): Promise<Category | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, description, color")
    .eq("slug", slug)
    .maybeSingle()
  return data
})

/** Derniers articles publiés (la RLS filtre déjà les brouillons pour le public). */
export async function getLatestArticles(options: {
  limit?: number
  categoryId?: string
  excludeId?: string
  page?: number
} = {}): Promise<{ articles: ArticleSummary[]; total: number }> {
  const { limit = 12, categoryId, excludeId, page = 1 } = options
  const supabase = await createClient()
  const from = (Math.max(1, page) - 1) * limit

  let query = supabase
    .from("articles")
    .select(SUMMARY_COLUMNS, { count: "exact" })
    .eq("published", true)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .range(from, from + limit - 1)

  if (categoryId) query = query.eq("category", categoryId)
  if (excludeId) query = query.neq("id", excludeId)

  const { data, error, count } = await query.overrideTypes<SummaryRow[], { merge: false }>()
  if (error) {
    console.error("getLatestArticles", error.message)
    return { articles: [], total: 0 }
  }
  return { articles: data.map(toSummary), total: count ?? 0 }
}

export type ArticleDetail = ArticleSummary & {
  content: string
  hasAccess: boolean
  published: boolean
  viewCount: number
}

/** Article complet ; le contenu est filtré par le paywall côté base. */
export const getArticleBySlug = cache(async (slug: string): Promise<ArticleDetail | null> => {
  const supabase = await createClient()

  const [{ data: row }, { data: body }] = await Promise.all([
    supabase
      .from("articles")
      .select(`${SUMMARY_COLUMNS}, published, view_count`)
      .eq("slug", slug)
      .maybeSingle()
      .overrideTypes<SummaryRow & { published: boolean; view_count: number }, { merge: false }>(),
    supabase.rpc("get_article_body", { p_slug: slug }).maybeSingle(),
  ])

  if (!row || !body) return null

  return {
    ...toSummary(row),
    content: body.content,
    hasAccess: body.has_access,
    published: row.published,
    viewCount: row.view_count,
  }
})
