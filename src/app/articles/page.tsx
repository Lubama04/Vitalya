import type { Metadata } from "next"
import { ArticleGridPage, parsePage } from "@/components/article/article-grid-page"
import { getLatestArticles } from "@/lib/data"

export const metadata: Metadata = {
  title: "Tous les articles",
  description: "Tous les articles du magazine Vitalya : santé, beauté naturelle, bien-être et nutrition.",
}

const PER_PAGE = 12

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>
}) {
  const page = parsePage((await searchParams).page)
  const { articles, total } = await getLatestArticles({ limit: PER_PAGE, page })

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <header className="mb-12 max-w-2xl">
        <p className="text-sm font-semibold tracking-wider text-orange uppercase">Le magazine</p>
        <h1 className="mt-1 text-5xl font-bold text-nuit">Tous les articles</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Conseils, enquêtes et rituels pour vivre mieux, naturellement.
        </p>
      </header>
      <ArticleGridPage
        articles={articles}
        page={page}
        totalPages={Math.ceil(total / PER_PAGE)}
        basePath="/articles"
        emptyMessage="Aucun article publié pour le moment."
      />
    </div>
  )
}
