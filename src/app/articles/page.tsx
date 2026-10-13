import type { Metadata } from "next"
import Link from "next/link"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
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
      <header className="mb-12 flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-wider text-orange-fonce uppercase">Le magazine</p>
          <h1 className="mt-1 text-4xl font-bold text-nuit sm:text-5xl">Tous les articles</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Conseils, enquêtes et rituels pour vivre mieux, naturellement.
          </p>
        </div>
        <Button asChild size="lg" className="h-12 bg-vert-fonce px-5 font-semibold text-white hover:bg-vert-fonce/90">
          <Link href="/magazine">
            <Download className="size-5" aria-hidden /> Télécharger le N°01 (PDF)
          </Link>
        </Button>
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
