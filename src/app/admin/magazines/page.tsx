import Link from "next/link"
import { BookOpen, Plus } from "lucide-react"
import { ContentImage } from "@/components/content-image"
import { Button } from "@/components/ui/button"
import { editionLabel, EDITION_COLUMNS, toEdition } from "@/lib/magazine/data"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Magazines" }

export default async function MagazinesAdminPage() {
  const supabase = await createClient()
  const { data } = await supabase.from("magazine_editions").select(EDITION_COLUMNS).order("numero", { ascending: false })
  const editions = (data ?? []).map(toEdition)

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-nuit">Magazines</h1>
          <p className="mt-1 text-sm text-muted-foreground">Numéros compilés en PDF (couverture, sommaire, articles).</p>
        </div>
        <Button asChild className="bg-orange font-semibold text-nuit hover:bg-orange/90">
          <Link href="/admin/magazines/nouveau">
            <Plus className="size-4" /> Nouveau numéro
          </Link>
        </Button>
      </header>

      {editions.length === 0 && <p className="rounded-2xl border bg-white p-10 text-center text-muted-foreground">Aucun numéro.</p>}

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {editions.map((edition) => (
          <li key={edition.id} className="min-w-0">
            <Link
              href={`/admin/magazines/${edition.id}`}
              className="group flex h-full gap-4 rounded-2xl border bg-white p-4 transition-shadow hover:border-vert-emeraude hover:shadow-md"
            >
              <div className="relative aspect-[800/1130] w-20 shrink-0 overflow-hidden rounded-md bg-vert-fonce">
                {edition.couvertureUrl ? (
                  <ContentImage src={edition.couvertureUrl} alt="" fill sizes="80px" className="object-cover" />
                ) : (
                  <BookOpen className="absolute inset-0 m-auto size-6 text-white/70" aria-hidden />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wider text-orange-fonce uppercase">N°{String(edition.numero).padStart(2, "0")}</p>
                <p className="line-clamp-2 font-semibold text-nuit group-hover:text-vert-fonce">{edition.titre}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {editionLabel(edition)} · {edition.articleIds.length} articles
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
