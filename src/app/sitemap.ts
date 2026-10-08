import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/env"
import { createPublicClient } from "@/lib/supabase/public"

// Sitemap dynamique : pages fixes, rubriques et articles publiés (régénéré toutes les heures)
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createPublicClient()
  const [{ data: articles }, { data: categories }] = await Promise.all([
    supabase
      .from("articles")
      .select("slug, updated_at, published_at, cover_image")
      .eq("published", true)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(5000),
    supabase.from("categories").select("slug").order("position"),
  ])

  const absolute = (path: string) => (path.startsWith("http") ? path : `${siteUrl}${path}`)
  const now = new Date()

  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/articles`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/abonnement`, changeFrequency: "monthly", priority: 0.6 },
    ...(categories ?? []).map((category) => ({
      url: `${siteUrl}/categories/${category.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...(articles ?? []).map((article) => ({
      url: `${siteUrl}/articles/${article.slug}`,
      lastModified: new Date(article.updated_at ?? article.published_at ?? now),
      changeFrequency: "monthly" as const,
      priority: 0.9,
      images: article.cover_image ? [absolute(article.cover_image)] : undefined,
    })),
  ]
}
