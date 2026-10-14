"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Crown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { dismissForDays, dismissForSession, isDismissedForDays, isDismissedForSession } from "@/components/conversion/dismissal"

const SESSION_KEY = "vitalya:popup-lecture-vue"
const CLOSED_KEY = "vitalya:popup-lecture-fermee"
const HIDE_DAYS = 7
// Temps de lecture réel (onglet visible) avant l'invitation
const DELAY_SECONDS = 120

/**
 * Invitation modale après 2 minutes de lecture d'un article (lecteur connecté gratuit uniquement :
 * la page ne monte ce composant que dans ce cas). Une fois par visite, puis 7 jours de silence après fermeture.
 */
export function ReadingNudge() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (isDismissedForSession(SESSION_KEY) || isDismissedForDays(CLOSED_KEY)) return
    let seconds = 0
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      seconds += 1
      if (seconds < DELAY_SECONDS) return
      window.clearInterval(timer)
      // Une autre page de la même visite a pu l'afficher entre-temps
      if (isDismissedForSession(SESSION_KEY)) return
      dismissForSession(SESSION_KEY)
      setOpen(true)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const close = () => {
    dismissForDays(CLOSED_KEY, HIDE_DAYS)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl p-6 text-center sm:max-w-md sm:p-8">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-vert-pale text-or">
          <Crown className="size-7" aria-hidden />
        </span>
        <DialogHeader className="items-center text-center">
          <DialogTitle className="font-heading text-2xl text-nuit sm:text-3xl">Vous appréciez Vitalya ?</DialogTitle>
          <DialogDescription className="text-base text-nuit/75">
            Accédez à tout le magazine pour moins de 200 FCFA par jour.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex flex-col gap-3">
          <Button asChild size="lg" className="h-12 w-full bg-vert-fonce text-white hover:bg-vert-fonce/90">
            <Link href="/abonnement" onClick={close}>
              Découvrir l&apos;abonnement Premium
            </Link>
          </Button>
          <Button type="button" size="lg" variant="secondary" className="h-12 w-full bg-muted text-nuit/80 hover:bg-muted/80" onClick={close}>
            Continuer en gratuit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
