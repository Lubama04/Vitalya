"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { setArticleAlerts } from "@/actions/profile"
import { Switch } from "@/components/ui/switch"

/** Interrupteur « Recevoir un email à chaque nouvel article ». */
export function ArticleAlertsToggle({ initial, emailEnabled }: { initial: boolean; emailEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initial)
  const [pending, startTransition] = useTransition()

  function toggle(next: boolean) {
    setEnabled(next)
    startTransition(async () => {
      const result = await setArticleAlerts(next)
      if (!result.ok) {
        setEnabled(!next)
        toast.error("Préférence non enregistrée, réessayez.")
        return
      }
      toast.success(next ? "Vous serez prévenu·e de chaque nouvel article." : "Alertes email désactivées.")
    })
  }

  return (
    <div className="mt-4 flex items-start gap-3">
      <Switch id="alertes-articles" checked={enabled} onCheckedChange={toggle} disabled={pending} aria-describedby="alertes-articles-aide" />
      <div>
        <label htmlFor="alertes-articles" className="text-sm font-medium">
          Email à chaque nouvel article
        </label>
        <p id="alertes-articles-aide" className="text-xs text-muted-foreground">
          {emailEnabled ? "Un email court dès la publication, désactivable à tout moment." : "Préférence enregistrée ; les envois démarreront prochainement."}
        </p>
      </div>
    </div>
  )
}
