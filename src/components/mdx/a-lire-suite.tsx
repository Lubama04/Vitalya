import { ArticleCard } from "@/components/article/article-card"
import { getLatestArticles } from "@/lib/data"

export type MdxArticleContext = { articleId?: string; categoryId?: string }

/** « À lire ensuite » : 3 articles liés (même rubrique, complétés par les plus récents). */
export async function ALireSuite({ titre, context }: { titre?: string; context: MdxArticleContext }) {
  const sameCategory = context.categoryId
    ? (await getLatestArticles({ limit: 3, categoryId: context.categoryId, excludeId: context.articleId })).articles
    : []

  let articles = sameCategory
  if (articles.length < 3) {
    const latest = (await getLatestArticles({ limit: 6, excludeId: context.articleId })).articles
    const seen = new Set(articles.map((article) => article.id))
    articles = [...articles, ...latest.filter((article) => !seen.has(article.id))].slice(0, 3)
  }
  if (articles.length === 0) return null

  return (
    <aside className="my-12 rounded-2xl border bg-creme/60 p-6" aria-label={titre ?? "À lire ensuite"}>
      <p className="mb-5 font-sans text-sm font-bold tracking-wider text-orange uppercase">{titre ?? "À lire ensuite"}</p>
      <div className="space-y-5 [&_a]:no-underline! [&_h3]:mt-0!">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} variant="compact" />
        ))}
      </div>
    </aside>
  )
}
