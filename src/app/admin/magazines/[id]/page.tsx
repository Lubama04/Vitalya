import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { MagazineEditor, type EditorArticle } from "@/components/admin/magazine-editor"
import { requireAdmin } from "@/lib/auth"
import { EDITION_COLUMNS, toEdition, type Edition } from "@/lib/magazine/data"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Numéro du magazine" }

export default async function MagazineEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const supabase = await createClient()

  let edition: Edition | null = null
  if (id !== "nouveau") {
    const { data } = await supabase.from("magazine_editions").select(EDITION_COLUMNS).eq("id", id).maybeSingle()
    if (!data) notFound()
    edition = toEdition(data)
  }

  // Tous les articles (publiés ou non) : l'équipe prépare le numéro à l'avance
  const { data: rows } = await supabase
    .from("articles")
    .select("id, title, slug, access_level, published, cover_image, category:categories(name, color)")
    .order("created_at", { ascending: true })
    .overrideTypes<EditorArticle[], { merge: false }>()

  const { data: last } = await supabase.from("magazine_editions").select("numero").order("numero", { ascending: false }).limit(1).maybeSingle()

  return (
    <div className="space-y-6">
      <Link href="/admin/magazines" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-nuit">
        <ArrowLeft className="size-4" /> Tous les numéros
      </Link>
      <h1 className="text-3xl font-bold text-nuit">{edition ? edition.titre : "Nouveau numéro"}</h1>
      <MagazineEditor edition={edition} articles={rows ?? []} nextNumero={(last?.numero ?? 0) + 1} />
    </div>
  )
}
