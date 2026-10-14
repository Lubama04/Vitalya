"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Crown, X } from "lucide-react"
import { useAccountState } from "@/components/layout/account-store"
import { Button } from "@/components/ui/button"
import { dismissForDays, isDismissedForDays } from "@/components/conversion/dismissal"

const STORAGE_KEY = "vitalya:encart-accueil-premium"
const HIDE_DAYS = 3

/**
 * Encart d'accueil (sous le hero) pour un lecteur connecté au niveau gratuit.
 * La page d'accueil est en cache : le compte est résolu dans le navigateur.
 */
export function HomeUpgradeBanner({ reservedCount }: { reservedCount: number }) {
  const account = useAccountState()
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setDismissed(isDismissedForDays(STORAGE_KEY))
  }, [])

  // Invité, abonné ou équipe : rien (l'invité voit le bandeau « mode invité »)
  if (account === "loading" || account === null || account.tier !== "free" || account.isStaff || dismissed) return null

  const greeting = account.firstName ? `Bonjour ${account.firstName} !` : "Bonjour !"
  const articles = reservedCount > 0 ? `aux ${reservedCount} articles de ce numéro` : "à tous les articles de ce numéro"

  return (
    <section aria-label="Passer à Premium" className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
      <div className="relative flex flex-col gap-4 rounded-2xl bg-vert-pale p-5 pr-12 sm:flex-row sm:items-center sm:gap-5 sm:p-6 sm:pr-14">
        <span className="hidden size-12 shrink-0 items-center justify-center rounded-full bg-white text-or shadow-sm sm:flex">
          <Crown className="size-6" aria-hidden />
        </span>
        <p className="flex-1 text-sm leading-relaxed text-nuit sm:text-base">
          <span className="font-semibold">{greeting}</span>{" "}
          <span className="hidden sm:inline">
            Vous lisez Vitalya gratuitement. Passez à Premium pour accéder {articles} et télécharger le magazine complet.
          </span>
          <span className="sm:hidden">Passez à Premium pour lire tout le numéro et télécharger le magazine.</span>
        </p>
        <Button asChild className="h-11 w-full bg-orange px-5 text-nuit hover:bg-orange/90 sm:w-auto">
          <Link href="/abonnement">Voir les offres</Link>
        </Button>
        <button
          type="button"
          onClick={() => {
            dismissForDays(STORAGE_KEY, HIDE_DAYS)
            setDismissed(true)
          }}
          className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full text-nuit/60 transition-colors hover:bg-white/70 hover:text-nuit"
          aria-label="Fermer"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </section>
  )
}
