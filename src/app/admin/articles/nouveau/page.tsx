import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ArticleEditor } from "@/components/admin/article-editor"
import { getCategories } from "@/lib/data"

export const metadata = { title: "Nouvel article" }

export default async function NewArticlePage() {
  const categories = await getCategories()

  return (
    <div className="space-y-6">
      <Link href="/admin/articles" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-nuit">
        <ArrowLeft className="size-4" /> Articles
      </Link>
      <h1 className="text-3xl font-bold text-nuit">Nouvel article</h1>
      <ArticleEditor
        article={{
          title: "",
          subtitle: "",
          slug: "",
          content: "",
          coverImage: "",
          category: categories[0]?.id ?? "",
          accessLevel: "free",
          published: false,
          publishedAt: null,
        }}
        categories={categories}
        canDelete={false}
      />
    </div>
  )
}
