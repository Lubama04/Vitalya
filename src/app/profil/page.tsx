import type { Metadata } from "next"
import Link from "next/link"
import { CreditCard, Crown, Heart, KeyRound, LayoutDashboard, Sparkles } from "lucide-react"
import { openBillingPortal } from "@/actions/billing"
import { ArticleCard } from "@/components/article/article-card"
import { ProfileForm } from "@/components/profile/profile-form"
import { ArticleAlertsToggle } from "@/components/profile/article-alerts-toggle"
import { PushToggle } from "@/components/profile/push-toggle"
import { Button } from "@/components/ui/button"
import { isStaff, requireViewer } from "@/lib/auth"
import { ACCESS_LABELS, formatDate, isAccessLevel, ROLE_LABELS } from "@/lib/constants"
import type { ArticleSummary, Category } from "@/lib/data"
import { publicEnv } from "@/lib/env"
import { features } from "@/lib/env.server"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Mon espace", robots: { index: false } }

type LikedRow = {
  article: {
    id: string
    title: string
    subtitle: string | null
    slug: string
    cover_image: string | null
    access_level: string
    published_at: string | null
    reading_time: number
    category: Category | null
  } | null
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ abonnement?: string }>
}) {
  const viewer = await requireViewer("/profil")
  const { abonnement } = await searchParams
  const supabase = await createClient()

  const [{ data: subscription }, { data: liked }, { data: preferences }] = await Promise.all([
    // Abonnement en cours (les paiements en attente ou échoués sont ignorés)
    supabase
      .from("subscriptions")
      .select("tier, status, current_period_end, payment_provider")
      .eq("user_id", viewer.id)
      .in("status", ["active", "canceled"])
      .order("current_period_end", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("likes")
      .select(
        "article:articles(id, title, subtitle, slug, cover_image, access_level, published_at, reading_time, category:categories(id, name, slug, description, color))",
      )
      .eq("user_id", viewer.id)
      .order("created_at", { ascending: false })
      .limit(6)
      .overrideTypes<LikedRow[], { merge: false }>(),
    supabase.from("profiles").select("notify_new_articles").eq("id", viewer.id).maybeSingle(),
  ])
  const providerLabel: Record<string, string> = {
    pawapay: "Mobile Money",
    moneyfusion: "Paiement en ligne (carte ou Mobile Money)",
    stripe: "Carte bancaire (Stripe)",
    manual: "Attribué par l'équipe",
  }
  const mobileMoney = subscription?.payment_provider === "pawapay" || subscription?.payment_provider === "moneyfusion"

  const likedArticles: ArticleSummary[] = (liked ?? [])
    .flatMap((row) => (row.article ? [row.article] : []))
    .map((article) => ({
      id: article.id,
      title: article.title,
      subtitle: article.subtitle,
      slug: article.slug,
      coverImage: article.cover_image,
      accessLevel: isAccessLevel(article.access_level) ? article.access_level : "free",
      publishedAt: article.published_at,
      readingTime: article.reading_time,
      category: article.category,
    }))

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-wider text-orange-fonce uppercase">Mon espace</p>
          <h1 className="mt-1 text-4xl font-bold text-nuit">Bonjour {viewer.fullName ?? ""} 🌿</h1>
          <p className="mt-2 text-muted-foreground">
            Membre depuis le {formatDate(viewer.createdAt)} · {ROLE_LABELS[viewer.role]}
          </p>
        </div>
        {isStaff(viewer) && (
          <Button asChild className="bg-nuit hover:bg-nuit/90">
            <Link href="/admin"><LayoutDashboard className="size-4" /> Back-office</Link>
          </Button>
        )}
      </header>

      {abonnement === "succes" && (
        <p role="status" className="mb-8 rounded-xl bg-vert-pale px-5 py-4 text-vert-fonce">
          Merci pour votre abonnement ! Votre accès sera activé dans quelques instants.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Abonnement */}
        <section className="rounded-3xl bg-gradient-to-br from-vert-fonce to-nuit p-7 text-white lg:col-span-1" aria-labelledby="titre-formule">
          <h2 id="titre-formule" className="flex items-center gap-2 font-sans text-sm font-semibold tracking-wider text-white/70 uppercase">
            <Crown className="size-4 text-or" aria-hidden /> Ma formule
          </h2>
          <p className="mt-3 font-heading text-4xl font-bold">{ACCESS_LABELS[viewer.tier]}</p>
          {subscription?.current_period_end && (
            <p className="mt-2 text-sm text-white/70">
              {subscription.status === "canceled" || mobileMoney ? "Accès jusqu'au" : "Renouvellement le"}{" "}
              {formatDate(subscription.current_period_end)}
            </p>
          )}
          {subscription?.payment_provider && (
            <p className="mt-1 text-sm text-white/70">Payé via {providerLabel[subscription.payment_provider] ?? subscription.payment_provider}</p>
          )}
          {mobileMoney && (
            <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/80">
              Paiement mobile sans renouvellement automatique : prolongez votre accès depuis la page Abonnement.
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            {(viewer.tier !== "expert" || mobileMoney) && (
              <Button asChild className="bg-orange text-nuit hover:bg-orange/90">
                <Link href="/abonnement">
                  <Sparkles className="size-4" /> {mobileMoney ? "Prolonger ou changer d'offre" : "Passer à l'offre supérieure"}
                </Link>
              </Button>
            )}
            {features.stripe && subscription?.payment_provider === "stripe" && (
              <form action={openBillingPortal}>
                <Button type="submit" variant="outline" className="w-full border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                  <CreditCard className="size-4" /> Gérer mon abonnement
                </Button>
              </form>
            )}
          </div>
        </section>

        {/* Informations */}
        <section className="rounded-3xl border bg-white p-7 lg:col-span-2" aria-labelledby="titre-infos">
          <h2 id="titre-infos" className="mb-5 text-2xl font-bold">Mes informations</h2>
          <ProfileForm fullName={viewer.fullName ?? ""} email={viewer.email} />
          <div className="mt-8 grid gap-6 border-t pt-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 font-sans text-sm font-semibold">Sécurité</h3>
              <Button asChild variant="outline">
                <Link href="/profil/mot-de-passe"><KeyRound className="size-4" /> Changer mon mot de passe</Link>
              </Button>
            </div>
            <div>
              <h3 className="mb-2 font-sans text-sm font-semibold">Notifications</h3>
              <PushToggle vapidPublicKey={publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />
              <ArticleAlertsToggle initial={preferences?.notify_new_articles ?? false} emailEnabled={features.email} />
            </div>
          </div>
        </section>
      </div>

      {/* Articles aimés */}
      <section className="mt-14" aria-labelledby="titre-aimes">
        <h2 id="titre-aimes" className="mb-6 flex items-center gap-2 text-2xl font-bold">
          <Heart className="size-6 text-orange" aria-hidden /> Mes articles aimés
        </h2>
        {likedArticles.length > 0 ? (
          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {likedArticles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-vert-pale/50 p-8 text-center text-muted-foreground">
            Aucun article aimé pour l&apos;instant. <Link href="/articles" className="font-semibold text-vert-fonce underline">Parcourir le magazine</Link>
          </p>
        )}
      </section>
    </div>
  )
}
