import Link from "next/link"
import { Search } from "lucide-react"
import { MemberRowForm } from "@/components/admin/member-row-form"
import { parsePage } from "@/components/article/article-grid-page"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getViewer } from "@/lib/auth"
import { ACCESS_LABELS, formatDate, isAccessLevel, isRole, ROLE_LABELS } from "@/lib/constants"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Abonnés" }

const PER_PAGE = 50

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const page = parsePage(params.page)
  // Échappement des jokers SQL LIKE dans la recherche
  const q = (params.q ?? "").trim().slice(0, 100)
  const pattern = `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`

  const supabase = await createClient()
  const viewer = await getViewer()
  const isAdmin = viewer?.role === "admin"

  let query = supabase
    .from("profiles")
    .select("id, email, full_name, subscription_tier, role, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1)
  if (q) query = query.ilike("email", pattern)

  const [{ data: members, count }, { count: newsletterCount }] = await Promise.all([
    query,
    supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }).is("unsubscribed_at", null),
  ])
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PER_PAGE))

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-nuit">Abonnés</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {count ?? 0} membre(s) · {newsletterCount ?? 0} inscrit(s) à la newsletter
          </p>
        </div>
        <form className="flex gap-2" role="search">
          <label htmlFor="q" className="sr-only">Rechercher par email</label>
          <Input id="q" name="q" defaultValue={q} placeholder="Rechercher un email…" className="w-64" />
          <Button type="submit" variant="outline" aria-label="Rechercher"><Search className="size-4" /></Button>
        </form>
      </header>

      {!isAdmin && (
        <p className="rounded-xl bg-or/15 px-4 py-3 text-sm">Lecture seule : seuls les administrateurs peuvent modifier les membres.</p>
      )}

      <div className="overflow-x-auto rounded-2xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Membre</TableHead>
              <TableHead className="hidden md:table-cell">Inscription</TableHead>
              <TableHead>{isAdmin ? "Formule · Rôle" : "Formule"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(members ?? []).map((member) => {
              const tier = isAccessLevel(member.subscription_tier) ? member.subscription_tier : "free"
              const role = isRole(member.role) ? member.role : "reader"
              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <p className="font-medium">{member.full_name || "Sans nom"}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{formatDate(member.created_at)}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <MemberRowForm userId={member.id} role={role} tier={tier} />
                    ) : (
                      <span className="text-sm">{ACCESS_LABELS[tier]} · {ROLE_LABELS[role]}</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
            {(members ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">Aucun membre trouvé.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-center gap-4 text-sm">
          {page > 1 && <Link href={`/admin/abonnes?page=${page - 1}&q=${encodeURIComponent(q)}`} className="underline">Précédent</Link>}
          <span>Page {page} / {totalPages}</span>
          {page < totalPages && <Link href={`/admin/abonnes?page=${page + 1}&q=${encodeURIComponent(q)}`} className="underline">Suivant</Link>}
        </nav>
      )}
    </div>
  )
}
