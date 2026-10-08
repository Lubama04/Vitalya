import type { Metadata } from "next"
import Link from "next/link"
import { Check, Crown, Gem, Leaf, ShieldCheck } from "lucide-react"
import { PricingButton } from "@/components/pricing-button"
import { Button } from "@/components/ui/button"
import { getViewer } from "@/lib/auth"
import { ACCESS_LABELS, PRICING, tierRank } from "@/lib/constants"
import { features } from "@/lib/env.server"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Abonnements",
  description: "Gratuit, Premium à 5 €/mois ou Expert à 10 €/mois : choisissez votre formule Vitalya.",
}

const ICONS = { free: Leaf, premium: Crown, expert: Gem } as const

const FAQ = [
  {
    q: "Puis-je résilier à tout moment ?",
    a: "Oui. L'abonnement est sans engagement : vous le gérez depuis votre espace abonné et gardez l'accès jusqu'à la fin de la période payée.",
  },
  {
    q: "Quels moyens de paiement sont acceptés ?",
    a: "Le paiement sécurisé est assuré par Stripe : cartes bancaires Visa, Mastercard et autres moyens selon votre pays.",
  },
  {
    q: "Puis-je passer de Premium à Expert ?",
    a: "Bien sûr. Le changement d'offre est immédiat et calculé au prorata.",
  },
]

export default async function PricingPage() {
  const viewer = await getViewer()
  const currentRank = viewer ? tierRank(viewer.tier) : -1

  return (
    <div className="bg-creme">
      <section className="mx-auto max-w-7xl px-4 pt-16 pb-8 text-center sm:px-6 lg:pt-20">
        <p className="text-sm font-semibold tracking-wider text-orange-fonce uppercase">Abonnements</p>
        <h1 className="mx-auto mt-2 max-w-3xl text-5xl font-bold text-nuit sm:text-6xl">
          Prenez soin de vous, <span className="text-vert-fonce italic">pleinement</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          Choisissez la formule qui vous ressemble et soutenez un média indépendant dédié à la santé
          et à la beauté africaines.
        </p>
        {!features.stripe && (
          <p className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full bg-or/20 px-4 py-2 text-sm font-medium text-nuit">
            Paiement en ligne bientôt disponible : les offres sont présentées à titre indicatif.
          </p>
        )}
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-3" aria-label="Formules">
        {PRICING.map((tier) => {
          const Icon = ICONS[tier.id]
          const isCurrent = viewer?.tier === tier.id
          const isIncluded = currentRank > tierRank(tier.id)
          return (
            <article
              key={tier.id}
              className={cn(
                "relative flex flex-col rounded-3xl border bg-white p-8 shadow-sm",
                tier.highlighted && "border-2 border-orange shadow-xl lg:-translate-y-3",
              )}
            >
              {tier.highlighted && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-orange px-4 py-1 text-xs font-bold tracking-wider text-nuit uppercase">
                  Le plus choisi
                </span>
              )}
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-11 items-center justify-center rounded-xl",
                    tier.id === "expert" ? "bg-nuit text-or" : tier.id === "premium" ? "bg-or text-nuit" : "bg-vert-pale text-vert-fonce",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <h2 className="text-2xl font-bold">{tier.name}</h2>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{tier.description}</p>
              <p className="mt-6 font-heading text-5xl font-bold text-nuit">
                {tier.price} €<span className="font-sans text-base font-normal text-muted-foreground"> /mois</span>
              </p>
              <ul className="mt-8 flex-1 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-3 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-vert-emeraude" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                {isCurrent ? (
                  <p className="rounded-xl bg-vert-pale py-3 text-center text-sm font-semibold text-vert-fonce">
                    Votre formule actuelle
                  </p>
                ) : isIncluded ? (
                  <p className="rounded-xl bg-muted py-3 text-center text-sm text-muted-foreground">
                    Inclus dans votre formule {viewer ? ACCESS_LABELS[viewer.tier] : ""}
                  </p>
                ) : tier.id === "free" ? (
                  <Button asChild size="lg" variant="outline" className="h-12 w-full text-base">
                    <Link href="/auth?mode=inscription">Créer un compte gratuit</Link>
                  </Button>
                ) : (
                  <PricingButton tier={tier.id} label={`Choisir ${tier.name}`} highlighted={tier.highlighted} />
                )}
              </div>
            </article>
          )
        })}
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-8 sm:px-6" aria-labelledby="titre-faq">
        <h2 id="titre-faq" className="mb-6 text-center text-3xl font-bold">Questions fréquentes</h2>
        <div className="divide-y rounded-2xl border bg-white">
          {FAQ.map((item) => (
            <details key={item.q} className="group p-6">
              <summary className="cursor-pointer list-none font-semibold text-nuit marker:hidden">
                <span className="flex items-center justify-between gap-4">
                  {item.q}
                  <span className="text-xl text-vert-emeraude transition-transform group-open:rotate-45" aria-hidden>+</span>
                </span>
              </summary>
              <p className="mt-3 text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 text-vert-emeraude" aria-hidden /> Paiement sécurisé par Stripe · Sans engagement
        </p>
      </section>
    </div>
  )
}
