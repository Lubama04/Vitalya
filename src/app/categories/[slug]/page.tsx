import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArticleGridPage, parsePage } from "@/components/article/article-grid-page"
import { textOn } from "@/lib/constants"
import { getCategories, getCategoryBySlug, getLatestArticles } from "@/lib/data"

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string | string[] }>
}

const PER_PAGE = 12

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await getCategoryBySlug((await params).slug)
  if (!category) return { title: "Rubrique introuvable" }
  return {
    title: category.name,
    description: category.description ?? undefined,
    alternates: { canonical: `/categories/${category.slug}` },
  }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, { page: rawPage }] = await Promise.all([params, searchParams])
  const [category, categories] = await Promise.all([getCategoryBySlug(slug), getCategories()])
  if (!category) notFound()

  const page = parsePage(rawPage)
  const { articles, total } = await getLatestArticles({ limit: PER_PAGE, page, categoryId: category.id })

  return (
    <>
      <header className="relative overflow-hidden" style={{ backgroundColor: category.color, color: textOn(category.color) }}>
        <div aria-hidden className="absolute -right-20 -bottom-20 size-80 rounded-full bg-white/10 blur-2xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
          <p className="text-sm font-semibold tracking-wider uppercase opacity-75">Rubrique</p>
          <h1 className="mt-2 text-5xl font-bold sm:text-6xl">{category.name}</h1>
          {category.description && <p className="mt-4 max-w-2xl text-lg opacity-85">{category.description}</p>}
        </div>
      </header>

      <nav aria-label="Rubriques" className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 sm:px-6">
          {categories.map((item) => (
            <Link
              key={item.id}
              href={`/categories/${item.slug}`}
              aria-current={item.id === category.id ? "page" : undefined}
              className="shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors hover:bg-vert-pale aria-[current=page]:border-transparent aria-[current=page]:bg-vert-fonce aria-[current=page]:text-white"
            >
              {item.name}
            </Link>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <ArticleGridPage
          articles={articles}
          page={page}
          totalPages={Math.ceil(total / PER_PAGE)}
          basePath={`/categories/${category.slug}`}
          emptyMessage="Les premiers articles de cette rubrique arrivent bientôt."
        />
      </div>
    </>
  )
}
