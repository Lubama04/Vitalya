import Link from "next/link"
import { ExternalLink, PenLine } from "lucide-react"
import { AccessBadge } from "@/components/article/access-badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, isAccessLevel } from "@/lib/constants"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Articles" }

export default async function AdminArticlesPage() {
  const supabase = await createClient()
  const { data: articles } = await supabase
    .from("articles")
    .select("id, title, slug, published, published_at, access_level, view_count, updated_at, category:categories(name)")
    .order("updated_at", { ascending: false })
    .limit(200)
    .overrideTypes<
      {
        id: string
        title: string
        slug: string
        published: boolean
        published_at: string | null
        access_level: string
        view_count: number
        updated_at: string
        category: { name: string } | null
      }[],
      { merge: false }
    >()

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-nuit">Articles</h1>
        <Button asChild className="bg-orange text-white hover:bg-orange/90">
          <Link href="/admin/articles/nouveau"><PenLine className="size-4" /> Nouvel article</Link>
        </Button>
      </header>

      <div className="overflow-hidden rounded-2xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titre</TableHead>
              <TableHead className="hidden md:table-cell">Rubrique</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="hidden sm:table-cell">Accès</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Vues</TableHead>
              <TableHead className="sr-only">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(articles ?? []).map((article) => (
              <TableRow key={article.id}>
                <TableCell className="max-w-72">
                  <Link href={`/admin/articles/${article.id}`} className="block truncate font-medium hover:underline">
                    {article.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">Modifié le {formatDate(article.updated_at)}</span>
                </TableCell>
                <TableCell className="hidden md:table-cell">{article.category?.name ?? "Aucune"}</TableCell>
                <TableCell>
                  {article.published ? (
                    <span className="rounded-full bg-vert-pale px-2.5 py-1 text-xs font-medium text-vert-fonce">
                      Publié {formatDate(article.published_at)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">Brouillon</span>
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {isAccessLevel(article.access_level) && article.access_level !== "free" ? (
                    <AccessBadge level={article.access_level} />
                  ) : (
                    <span className="text-xs text-muted-foreground">Gratuit</span>
                  )}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums lg:table-cell">{article.view_count}</TableCell>
                <TableCell className="text-right">
                  <Link href={`/articles/${article.slug}`} className="inline-flex p-1 text-muted-foreground hover:text-nuit" aria-label={`Voir « ${article.title} »`}>
                    <ExternalLink className="size-4" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {(articles ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Aucun article.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
