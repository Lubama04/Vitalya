import Link from "next/link"
import { Eye, FileText, Heart, Mail, MessageCircle, PenLine, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ACCESS_LABELS, ACCESS_LEVELS, formatDate } from "@/lib/constants"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Statistiques" }

export default async function AdminDashboard() {
  const supabase = await createClient()
  const head = { count: "exact", head: true } as const

  const [published, drafts, members, subscribers, comments, likes, articles, tiers, recent] = await Promise.all([
    supabase.from("articles").select("id", head).eq("published", true),
    supabase.from("articles").select("id", head).eq("published", false),
    supabase.from("profiles").select("id", head),
    supabase.from("newsletter_subscribers").select("id", head).is("unsubscribed_at", null),
    supabase.from("comments").select("id", head),
    supabase.from("likes").select("id", head),
    supabase.from("articles").select("id, title, slug, view_count, published").order("view_count", { ascending: false }).limit(200),
    Promise.all(
      ACCESS_LEVELS.map((tier) => supabase.from("profiles").select("id", head).eq("subscription_tier", tier)),
    ),
    supabase.from("profiles").select("id, full_name, email, subscription_tier, created_at").order("created_at", { ascending: false }).limit(5),
  ])

  const totalViews = (articles.data ?? []).reduce((sum, article) => sum + article.view_count, 0)
  const topArticles = (articles.data ?? []).slice(0, 5)
  const tierCounts = ACCESS_LEVELS.map((tier, index) => ({ tier, count: tiers[index]?.count ?? 0 }))
  const maxTier = Math.max(1, ...tierCounts.map((item) => item.count))

  const cards = [
    { label: "Articles publiés", value: published.count ?? 0, hint: `${drafts.count ?? 0} brouillon(s)`, icon: FileText },
    { label: "Vues totales", value: totalViews, hint: "toutes les pages articles", icon: Eye },
    { label: "Membres inscrits", value: members.count ?? 0, hint: "comptes créés", icon: Users },
    { label: "Abonnés newsletter", value: subscribers.count ?? 0, hint: "actifs", icon: Mail },
    { label: "Commentaires", value: comments.count ?? 0, hint: "au total", icon: MessageCircle },
    { label: "J'aime", value: likes.count ?? 0, hint: "au total", icon: Heart },
  ]

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-nuit">Statistiques</h1>
        <Button asChild className="bg-orange text-white hover:bg-orange/90">
          <Link href="/admin/articles/nouveau"><PenLine className="size-4" /> Nouvel article</Link>
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, hint, icon: Icon }) => (
          <div key={label} className="rounded-2xl border bg-white p-5">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              {label} <Icon className="size-4 text-vert-emeraude" aria-hidden />
            </div>
            <p className="mt-2 font-heading text-4xl font-bold text-nuit">{value.toLocaleString("fr-FR")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border bg-white p-6" aria-labelledby="titre-top">
          <h2 id="titre-top" className="mb-4 text-xl font-bold">Articles les plus lus</h2>
          <ol className="space-y-3">
            {topArticles.map((article, index) => (
              <li key={article.id} className="flex items-center gap-3 text-sm">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-vert-pale text-xs font-bold text-vert-fonce">{index + 1}</span>
                <Link href={`/admin/articles/${article.id}`} className="min-w-0 flex-1 truncate hover:underline">{article.title}</Link>
                <span className="shrink-0 tabular-nums text-muted-foreground">{article.view_count.toLocaleString("fr-FR")} vues</span>
              </li>
            ))}
            {topArticles.length === 0 && <li className="text-sm text-muted-foreground">Aucun article.</li>}
          </ol>
        </section>

        <section className="rounded-2xl border bg-white p-6" aria-labelledby="titre-formules">
          <h2 id="titre-formules" className="mb-4 text-xl font-bold">Répartition des formules</h2>
          <ul className="space-y-4">
            {tierCounts.map(({ tier, count }) => (
              <li key={tier}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{ACCESS_LABELS[tier]}</span>
                  <span className="tabular-nums text-muted-foreground">{count}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="presentation">
                  <div
                    className={tier === "expert" ? "h-full bg-nuit" : tier === "premium" ? "h-full bg-or" : "h-full bg-vert-emeraude"}
                    style={{ width: `${(count / maxTier) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <h3 className="mt-8 mb-3 font-sans text-sm font-semibold">Derniers inscrits</h3>
          <ul className="divide-y text-sm">
            {(recent.data ?? []).map((member) => (
              <li key={member.id} className="flex justify-between gap-3 py-2">
                <span className="truncate">{member.full_name || member.email}</span>
                <span className="shrink-0 text-muted-foreground">{formatDate(member.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
