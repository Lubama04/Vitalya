import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { z } from "zod"
import { deleteArticle } from "@/actions/admin"
import { ArticleEditor } from "@/components/admin/article-editor"
import { getViewer } from "@/lib/auth"
import { isAccessLevel } from "@/lib/constants"
import { getCategories } from "@/lib/data"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Modifier l'article" }

export default async function EditArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ cree?: string }>
}) {
  const [{ id }, { cree }] = await Promise.all([params, searchParams])
  if (!z.uuid().safeParse(id).success) notFound()

  const supabase = await createClient()
  const [{ data: article }, categories, viewer, { data: authors }] = await Promise.all([
    // Le contenu n'est lisible que via cette fonction réservée à l'équipe
    supabase.rpc("get_article_for_edit", { p_id: id }).maybeSingle(),
    getCategories(),
    getViewer(),
    supabase.from("authors").select("id, name").order("name"),
  ])
  if (!article) notFound()

  return (
    <div className="space-y-6">
      <Link href="/admin/articles" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-nuit">
        <ArrowLeft className="size-4" /> Articles
      </Link>
      <h1 className="text-3xl font-bold text-nuit">Modifier l&apos;article</h1>
      {cree && (
        <p role="status" className="rounded-xl bg-vert-pale px-4 py-3 text-sm text-vert-fonce">Article créé avec succès.</p>
      )}
      <ArticleEditor
        article={{
          id: article.id,
          title: article.title,
          subtitle: article.subtitle ?? "",
          slug: article.slug,
          content: article.content,
          coverImage: article.cover_image ?? "",
          category: article.category ?? "",
          authorProfileId: article.author_profile_id ?? "",
          accessLevel: isAccessLevel(article.access_level) ? article.access_level : "free",
          published: article.published,
          publishedAt: article.published_at,
        }}
        categories={categories}
        authors={authors ?? []}
        canDelete={viewer?.role === "admin"}
        deleteAction={deleteArticle}
      />
    </div>
  )
}
