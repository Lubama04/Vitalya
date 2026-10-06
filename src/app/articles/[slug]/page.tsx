import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarDays, Clock, Eye, Pencil } from "lucide-react"
import { AccessBadge } from "@/components/article/access-badge"
import { ArticleCard } from "@/components/article/article-card"
import { Comments } from "@/components/article/comments"
import { LikeButton } from "@/components/article/like-button"
import { MdxContent } from "@/components/mdx/mdx-content"
import { Paywall } from "@/components/article/paywall"
import { ShareButton } from "@/components/article/share-button"
import { ViewTracker } from "@/components/article/view-tracker"
import { getViewer, isStaff } from "@/lib/auth"
import { formatDate, SITE, textOn } from "@/lib/constants"
import { getArticleBySlug, getLatestArticles } from "@/lib/data"
import { createClient } from "@/lib/supabase/server"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) return { title: "Article introuvable" }

  return {
    title: article.title,
    description: article.subtitle ?? SITE.description,
    alternates: { canonical: `/articles/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.subtitle ?? undefined,
      publishedTime: article.publishedAt ?? undefined,
      images: article.coverImage ? [{ url: article.coverImage }] : undefined,
    },
    robots: article.published ? undefined : { index: false, follow: false },
  }
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params
  const [article, viewer] = await Promise.all([getArticleBySlug(slug), getViewer()])
  if (!article) notFound()

  const supabase = await createClient()
  const [{ data: stats }, { data: comments }, related] = await Promise.all([
    supabase.rpc("get_article_stats", { p_article_id: article.id }).maybeSingle(),
    supabase.rpc("get_article_comments", { p_article_id: article.id }),
    getLatestArticles({ limit: 3, categoryId: article.category?.id, excludeId: article.id }),
  ])

  // Données structurées pour le référencement
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.subtitle,
    datePublished: article.publishedAt,
    image: article.coverImage ? [article.coverImage] : undefined,
    isAccessibleForFree: article.accessLevel === "free",
    publisher: { "@type": "Organization", name: SITE.name },
  }

  return (
    <article>
      <ViewTracker slug={article.slug} />
      <script
        type="application/ld+json"
        // JSON sérialisé : les « < » sont échappés pour empêcher toute sortie du bloc script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      {/* ─── Couverture pleine largeur ─── */}
      <header className="relative isolate flex min-h-[min(72vh,760px)] items-end overflow-hidden bg-nuit text-white">
        {article.coverImage && (
          <Image
            src={article.coverImage}
            alt=""
            fill
            priority
            sizes="100vw"
            className="-z-10 object-cover"
          />
        )}
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-nuit via-nuit/60 to-nuit/10" />
        <div className="mx-auto w-full max-w-4xl px-4 pt-32 pb-12 sm:px-6 lg:pb-16">
          <Link href="/articles" className="mb-6 inline-flex items-center gap-1 text-sm text-white/75 hover:text-white">
            <ArrowLeft className="size-4" /> Tous les articles
          </Link>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {article.category && (
              <Link
                href={`/categories/${article.category.slug}`}
                className="rounded-full px-3 py-1 text-xs font-semibold tracking-wider uppercase"
                style={{ backgroundColor: article.category.color, color: textOn(article.category.color) }}
              >
                {article.category.name}
              </Link>
            )}
            <AccessBadge level={article.accessLevel} />
            {!article.published && (
              <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold uppercase">Brouillon</span>
            )}
          </div>
          <h1 className="font-heading text-4xl leading-[1.1] font-bold text-balance sm:text-5xl lg:text-6xl">
            {article.title}
          </h1>
          {article.subtitle && (
            <p className="mt-5 max-w-3xl font-heading text-xl leading-relaxed text-white/85 italic sm:text-2xl">
              {article.subtitle}
            </p>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/75">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden />
              <time dateTime={article.publishedAt ?? undefined}>{formatDate(article.publishedAt)}</time>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden /> {article.readingTime} min de lecture
            </span>
            {isStaff(viewer) && (
              <>
                <span className="flex items-center gap-1.5">
                  <Eye className="size-4" aria-hidden /> {article.viewCount} vues
                </span>
                <Link href={`/admin/articles/${article.id}`} className="flex items-center gap-1.5 text-or hover:underline">
                  <Pencil className="size-4" aria-hidden /> Modifier
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── Contenu ─── */}
      <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
        <div className="prose-vitalya">
          <MdxContent source={article.content} context={{ articleId: article.id, categoryId: article.category?.id }} />
        </div>

        {!article.hasAccess && (
          <div className="mt-8">
            <Paywall level={article.accessLevel} isAuthenticated={Boolean(viewer)} />
          </div>
        )}

        <div className="mt-12 flex flex-wrap items-center gap-3 border-y py-6">
          <LikeButton
            articleId={article.id}
            initial={{ liked: stats?.liked_by_me ?? false, count: stats?.likes_count ?? 0 }}
            isAuthenticated={Boolean(viewer)}
          />
          <ShareButton title={article.title} />
          <p className="ml-auto font-heading text-sm text-muted-foreground italic">Vivre mieux, naturellement.</p>
        </div>

        <Comments
          articleId={article.id}
          initialComments={comments ?? []}
          viewerId={viewer?.id ?? null}
          canModerate={isStaff(viewer)}
        />
      </div>

      {/* ─── Articles similaires ─── */}
      {related.articles.length > 0 && (
        <section aria-labelledby="titre-similaires" className="mx-auto mt-20 max-w-7xl px-4 sm:px-6">
          <h2 id="titre-similaires" className="mb-8 text-3xl font-bold text-nuit">À lire aussi</h2>
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {related.articles.map((item) => (
              <ArticleCard key={item.id} article={item} />
            ))}
          </div>
        </section>
      )}
    </article>
  )
}
