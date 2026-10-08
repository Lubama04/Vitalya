import "server-only"
import { cache } from "react"
import { createPublicClient } from "@/lib/supabase/public"
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
  const supabase = createPublicClient()
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
  const supabase = createPublicClient()
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, description, color")
    .eq("slug", slug)
    .maybeSingle()
  return data
})

/** Derniers articles publiés (client public : la RLS ne renvoie que les articles publiés). */
export async function getLatestArticles(options: {
  limit?: number
  categoryId?: string
  excludeId?: string
  page?: number
} = {}): Promise<{ articles: ArticleSummary[]; total: number }> {
  const { limit = 12, categoryId, excludeId, page = 1 } = options
  const supabase = createPublicClient()
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
  authorProfileId: string | null
  updatedAt: string
}

export type PublicAuthor = { name: string; photo_url: string | null; bio: string | null; specialty: string | null }

/** Profil public d'un auteur (l'email n'est jamais lisible via l'API). */
export const getAuthor = cache(async (id: string | null): Promise<PublicAuthor | null> => {
  if (!id) return null
  const supabase = createPublicClient()
  const { data } = await supabase.from("authors").select("name, photo_url, bio, specialty").eq("id", id).maybeSingle()
  return data
})

/** Article complet ; le contenu est filtré par le paywall côté base. */
export const getArticleBySlug = cache(async (slug: string): Promise<ArticleDetail | null> => {
  const supabase = await createClient()

  const [{ data: row }, { data: body }] = await Promise.all([
    supabase
      .from("articles")
      .select(`${SUMMARY_COLUMNS}, published, view_count, author_profile_id, updated_at`)
      .eq("slug", slug)
      .maybeSingle()
      .overrideTypes<SummaryRow & { published: boolean; view_count: number; author_profile_id: string | null; updated_at: string }, { merge: false }>(),
    supabase.rpc("get_article_body", { p_slug: slug }).maybeSingle(),
  ])

  if (!row || !body) return null

  return {
    ...toSummary(row),
    content: body.content,
    hasAccess: body.has_access,
    published: row.published,
    viewCount: row.view_count,
    authorProfileId: row.author_profile_id,
    updatedAt: row.updated_at,
  }
})
