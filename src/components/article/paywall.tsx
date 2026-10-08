import Link from "next/link"
import { Crown, Gem, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ACCESS_LABELS, PRICING, type AccessLevel } from "@/lib/constants"

/** Encart affiché à la place de la suite d'un article réservé. */
export function Paywall({ level, isAuthenticated }: { level: AccessLevel; isAuthenticated: boolean }) {
  const tier = PRICING.find((item) => item.id === level)
  const Icon = level === "expert" ? Gem : Crown

  return (
    <div className="relative">
      {/* Fondu sur la fin de l'aperçu */}
      <div aria-hidden className="pointer-events-none absolute -top-40 right-0 left-0 h-40 bg-gradient-to-b from-white/0 to-white" />
      <div className="relative overflow-hidden rounded-3xl border border-or/40 bg-gradient-to-br from-nuit to-vert-fonce p-8 text-center text-white shadow-xl sm:p-12">
        <div aria-hidden className="absolute -top-16 -right-16 size-48 rounded-full bg-or/20 blur-2xl" />
        <div className="relative">
          <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-or text-nuit">
            <Lock className="size-6" aria-hidden />
          </span>
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-wider text-or uppercase">
            <Icon className="size-4" aria-hidden /> Article {ACCESS_LABELS[level]}
          </p>
          <h2 className="mt-3 font-heading text-3xl font-bold">La suite est réservée à nos abonnés</h2>
          <p className="mx-auto mt-3 max-w-md text-white/75">
            Abonnez-vous à l&apos;offre {ACCESS_LABELS[level]}
            {tier ? ` pour ${tier.price} € par mois` : ""} et lisez cet article en entier, ainsi que tous
            nos dossiers.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 bg-orange px-6 text-nuit hover:bg-orange/90">
              <Link href="/abonnement">Je m&apos;abonne</Link>
            </Button>
            {!isAuthenticated && (
              <Button asChild size="lg" variant="outline" className="h-12 border-white/30 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white">
                <Link href="/auth">Déjà abonné·e ? Se connecter</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
