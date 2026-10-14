"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserRound, X } from "lucide-react"
import { useAccountState } from "@/components/layout/account-store"
import { Button } from "@/components/ui/button"
import { dismissForSession, isDismissedForSession } from "@/components/conversion/dismissal"

const STORAGE_KEY = "vitalya:bandeau-invite"
// Pages où l'invitation à créer un compte n'a pas sa place
const HIDDEN_PREFIXES = ["/auth", "/admin", "/mentions-legales", "/cgv", "/confidentialite"]

/**
 * Bandeau « mode invité » au-dessus du pied de page, pour les visiteurs non connectés uniquement.
 * Fermé, il revient à la visite suivante (mémoire de session).
 */
export function GuestBanner() {
  const pathname = usePathname()
  const account = useAccountState()
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setDismissed(isDismissedForSession(STORAGE_KEY))
  }, [])

  const hiddenHere = HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  // Rien tant que la session n'est pas résolue : jamais de bandeau invité pour un lecteur connecté
  if (account !== null || dismissed || hiddenHere) return null

  const next = encodeURIComponent(pathname)

  return (
    <aside aria-label="Créer un compte" className="mx-auto mt-16 w-full max-w-5xl px-4 sm:px-6">
      <div className="relative flex flex-col gap-4 rounded-2xl border-2 border-vert-fonce bg-white p-5 pr-12 shadow-sm sm:flex-row sm:items-center sm:gap-5 sm:p-6 sm:pr-14">
        <span className="hidden size-12 shrink-0 items-center justify-center rounded-full bg-vert-pale text-vert-fonce sm:flex">
          <UserRound className="size-6" aria-hidden />
        </span>
        <p className="flex-1 text-sm leading-relaxed text-nuit sm:text-base">
          <span className="font-semibold">Vous lisez Vitalya en mode invité.</span>{" "}
          <span className="hidden sm:inline">
            Créez votre compte gratuit pour sauvegarder vos articles et accéder à plus de contenu.
          </span>
          <span className="sm:hidden">Créez votre compte gratuit pour en profiter pleinement.</span>
        </p>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <Button asChild className="h-11 w-full bg-vert-fonce px-5 text-white hover:bg-vert-fonce/90 sm:w-auto">
            <Link href={`/auth?mode=inscription&next=${next}`}>Créer mon compte</Link>
          </Button>
          <Link
            href={`/auth?next=${next}`}
            className="text-center text-sm font-medium text-vert-fonce underline-offset-4 hover:underline sm:text-right"
          >
            J&apos;ai déjà un compte →
          </Link>
        </div>
        <button
          type="button"
          onClick={() => {
            dismissForSession(STORAGE_KEY)
            setDismissed(true)
          }}
          className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full text-nuit/60 transition-colors hover:bg-muted hover:text-nuit"
          aria-label="Fermer"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </aside>
  )
}
