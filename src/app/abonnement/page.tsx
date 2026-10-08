import type { Metadata } from "next"
import Link from "next/link"
import { Check, Crown, Gem, Leaf, ShieldCheck, Smartphone } from "lucide-react"
import { PaymentBadges } from "@/components/payment-badges"
import { PaymentDialog } from "@/components/payment-dialog"
import { Button } from "@/components/ui/button"
import { getViewer } from "@/lib/auth"
import { ACCESS_LABELS, formatFcfa, PRICING, tierRank } from "@/lib/constants"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Abonnements",
  description:
    "Gratuit, Premium à 6 000 FCFA ou Expert à 11 000 FCFA par mois, payable par Mobile Money, Wave ou carte bancaire : choisissez votre formule Vitalya.",
}

const ICONS = { free: Leaf, premium: Crown, expert: Gem } as const

const FAQ = [
  {
    q: "Quels moyens de paiement sont acceptés ?",
    a: "Mobile Money via PawaPay au Tchad et au Cameroun (MTN, Orange, Airtel selon les pays), ainsi que la carte bancaire Visa / Mastercard, Wave et le Mobile Money UEMOA (Côte d'Ivoire, Sénégal…) via MoneyFusion.",
  },
  {
    q: "Mon abonnement se renouvelle-t-il automatiquement ?",
    a: "Non. Chaque paiement ouvre un mois d'accès. Avant l'échéance, il suffit de payer à nouveau depuis cette page : les jours restants sont conservés et la nouvelle période s'ajoute à la suite.",
  },
  {
    q: "Comment se déroule un paiement Mobile Money ?",
    a: "Vous choisissez votre opérateur et saisissez votre numéro, puis vous validez la demande sur votre téléphone avec votre code secret. L'accès est activé automatiquement dès la confirmation de l'opérateur, et un email récapitulatif vous est envoyé.",
  },
  {
    q: "Puis-je passer de Premium à Expert ?",
    a: "Bien sûr : choisissez Expert, l'accès Expert est activé dès le paiement confirmé.",
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
        <p className="mx-auto mt-6 inline-flex flex-wrap items-center justify-center gap-2 rounded-full bg-vert-pale px-4 py-2 text-sm font-medium text-vert-fonce">
          <ShieldCheck className="size-4" aria-hidden /> Paiement sécurisé : Orange Money, Airtel, MTN, Wave, Visa, Mastercard
        </p>
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
              <p className="mt-6 font-heading text-4xl font-bold whitespace-nowrap text-nuit">
                {formatFcfa(tier.priceFcfa)}
                <span className="font-sans text-base font-normal text-muted-foreground"> /mois</span>
              </p>
              {tier.price > 0 && <p className="mt-1 text-sm text-muted-foreground">environ {tier.price} €</p>}
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
                  <div className="space-y-3">
                    <p className="rounded-xl bg-vert-pale py-3 text-center text-sm font-semibold text-vert-fonce">
                      Votre formule actuelle
                    </p>
                    {tier.id !== "free" && (
                      <PaymentDialog
                        tier={tier.id === "expert" ? "expert" : "premium"}
                        tierName={tier.name}
                        priceEur={tier.price}
                    priceFcfa={tier.priceFcfa}
                        label="Prolonger d'un mois"
                        isAuthenticated
                      />
                    )}
                  </div>
                ) : isIncluded && tier.id !== "free" ? (
                  <PaymentDialog
                    tier={tier.id === "expert" ? "expert" : "premium"}
                    tierName={tier.name}
                    priceEur={tier.price}
                    priceFcfa={tier.priceFcfa}
                    label="Prolonger ou reprendre"
                    isAuthenticated
                  />
                ) : isIncluded ? (
                  <p className="rounded-xl bg-muted py-3 text-center text-sm text-muted-foreground">
                    Inclus dans votre formule {viewer ? ACCESS_LABELS[viewer.tier] : ""}
                  </p>
                ) : tier.id === "free" ? (
                  <Button asChild size="lg" variant="outline" className="h-12 w-full text-base">
                    <Link href="/auth?mode=inscription">Créer un compte gratuit</Link>
                  </Button>
                ) : (
                  <PaymentDialog
                    tier={tier.id === "expert" ? "expert" : "premium"}
                    tierName={tier.name}
                    priceEur={tier.price}
                    priceFcfa={tier.priceFcfa}
                    label={`Choisir ${tier.name}`}
                    highlighted={tier.highlighted}
                    isAuthenticated={Boolean(viewer)}
                  />
                )}
                {tier.id !== "free" && <PaymentBadges className="mt-4 justify-center" />}
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
          <Smartphone className="size-4 text-vert-emeraude" aria-hidden /> Paiement sécurisé par PawaPay et MoneyFusion · Sans engagement · Sans renouvellement automatique
        </p>
      </section>
    </div>
  )
}
