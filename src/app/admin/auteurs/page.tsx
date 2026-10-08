import { Trash2, UserPen } from "lucide-react"
import { deleteAuthor } from "@/actions/admin"
import { AuthorForm } from "@/components/admin/author-form"
import { ProfilAuteur } from "@/components/mdx/cards"
import { Button } from "@/components/ui/button"
import { getViewer } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Auteurs" }

export default async function AuthorsPage() {
  const supabase = await createClient()
  // Liste complète (avec email) via fonction réservée à l'équipe
  const [{ data: authors }, viewer, { data: usage }] = await Promise.all([
    supabase.rpc("admin_list_authors"),
    getViewer(),
    supabase.from("articles").select("author_profile_id").not("author_profile_id", "is", null),
  ])
  const counts = new Map<string, number>()
  for (const row of usage ?? []) {
    if (row.author_profile_id) counts.set(row.author_profile_id, (counts.get(row.author_profile_id) ?? 0) + 1)
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-nuit">Auteurs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Les profils signent les articles et s&apos;affichent en fin de lecture. L&apos;email reste privé.
        </p>
      </header>

      <section className="rounded-2xl border bg-white p-6" aria-labelledby="titre-nouvel-auteur">
        <h2 id="titre-nouvel-auteur" className="mb-4 font-sans text-lg font-semibold">Nouvel auteur</h2>
        <AuthorForm author={{ name: "", specialty: "", bio: "", email: "", photoUrl: "" }} />
      </section>

      <section className="space-y-4" aria-labelledby="titre-auteurs">
        <h2 id="titre-auteurs" className="font-sans text-lg font-semibold">Profils ({authors?.length ?? 0})</h2>
        {(authors ?? []).map((author) => (
          <details key={author.id} className="group rounded-2xl border bg-white">
            <summary className="cursor-pointer list-none p-2 marker:hidden">
              <ProfilAuteur author={author} className="my-0 border-0 bg-transparent" />
              <p className="flex items-center gap-2 px-6 pb-3 text-xs text-muted-foreground">
                <UserPen className="size-3.5" /> {counts.get(author.id) ?? 0} article(s) · {author.email ?? "sans email"} · cliquer pour modifier
              </p>
            </summary>
            <div className="space-y-4 border-t p-6">
              <AuthorForm
                author={{
                  id: author.id,
                  name: author.name,
                  specialty: author.specialty ?? "",
                  bio: author.bio ?? "",
                  email: author.email ?? "",
                  photoUrl: author.photo_url ?? "",
                }}
              />
              {viewer?.role === "admin" && (
                <form action={deleteAuthor} className="border-t pt-4">
                  <input type="hidden" name="id" value={author.id} />
                  <Button type="submit" variant="destructive" size="sm">
                    <Trash2 className="size-4" /> Supprimer ce profil
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">Les articles signés restent publiés, sans auteur affiché.</p>
                </form>
              )}
            </div>
          </details>
        ))}
        {(authors ?? []).length === 0 && <p className="rounded-2xl bg-vert-pale/50 p-6 text-sm text-muted-foreground">Aucun auteur pour le moment.</p>}
      </section>
    </div>
  )
}
