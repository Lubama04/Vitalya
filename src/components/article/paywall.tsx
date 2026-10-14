import Link from "next/link"
import { Crown, Gem, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ACCESS_LABELS, formatFcfa, PRICING, type AccessLevel } from "@/lib/constants"

/**
 * Encart affiché après l'aperçu d'un article réservé (titre et couverture sont dans l'en-tête,
 * les 2 premiers paragraphes viennent de get_article_body). Un fondu blanc masque la fin de l'aperçu.
 */
export function Paywall({ level, isAuthenticated }: { level: AccessLevel; isAuthenticated: boolean }) {
  const tier = PRICING.find((item) => item.id === level)
  const label = ACCESS_LABELS[level]
  const Icon = level === "expert" ? Gem : Crown

  return (
    <div className="relative">
      {/* Fondu blanc sur la fin de l'aperçu */}
      <div aria-hidden className="pointer-events-none absolute -top-48 right-0 left-0 h-48 bg-gradient-to-b from-white/0 via-white/85 to-white" />
      <div className="relative mx-auto max-w-2xl rounded-3xl border-2 border-vert-fonce/80 bg-white p-6 text-center shadow-xl sm:p-10">
        <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-vert-pale text-vert-fonce">
          <Lock className="size-6" aria-hidden />
        </span>
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-orange-fonce uppercase sm:text-sm">
          <Icon className="size-4" aria-hidden /> Article {label}
        </p>
        <h2 className="mt-3 font-heading text-2xl font-bold text-nuit sm:text-3xl">
          Cet article est réservé aux abonnés {label}.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-nuit/75">
          Rejoignez Vitalya {label} pour lire cet article et tous les suivants.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4">
          <Button asChild size="lg" className="h-12 w-full bg-orange px-6 text-base text-nuit hover:bg-orange/90 sm:w-auto">
            <Link href="/abonnement">
              S&apos;abonner{tier ? ` · ${formatFcfa(tier.priceFcfa)}/mois` : ""}
            </Link>
          </Button>
          <Link href="/abonnement" className="text-sm font-semibold text-vert-fonce underline-offset-4 hover:underline">
            Voir toutes les offres
          </Link>
          {!isAuthenticated && (
            <Link href="/auth" className="text-sm text-nuit/70 underline-offset-4 hover:underline">
              Déjà abonné·e ? Se connecter
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
