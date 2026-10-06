import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { ArticleCard } from "@/components/article/article-card"
import { Button } from "@/components/ui/button"
import type { ArticleSummary } from "@/lib/data"

/** Grille d'articles paginée, partagée par /articles et /categories/[slug]. */
export function ArticleGridPage({
  articles,
  page,
  totalPages,
  basePath,
  emptyMessage,
}: {
  articles: ArticleSummary[]
  page: number
  totalPages: number
  basePath: string
  emptyMessage: string
}) {
  if (articles.length === 0) {
    return <p className="rounded-2xl bg-vert-pale/50 p-10 text-center text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <>
      <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article, index) => (
          <ArticleCard key={article.id} article={article} priority={index < 3} />
        ))}
      </div>
      {totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-14 flex items-center justify-center gap-3">
          <Button asChild variant="outline" className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
            <Link href={`${basePath}?page=${page - 1}`} aria-disabled={page <= 1}>
              <ChevronLeft className="size-4" /> Précédent
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <Button
            asChild
            variant="outline"
            className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
          >
            <Link href={`${basePath}?page=${page + 1}`} aria-disabled={page >= totalPages}>
              Suivant <ChevronRight className="size-4" />
            </Link>
          </Button>
        </nav>
      )}
    </>
  )
}

export function parsePage(value: string | string[] | undefined): number {
  const page = Number.parseInt(typeof value === "string" ? value : "1", 10)
  return Number.isFinite(page) && page > 0 ? Math.min(page, 1000) : 1
}
