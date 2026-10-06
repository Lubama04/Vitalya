"use client"

import { Share2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

/** Partage natif (mobile) ou copie du lien (desktop). */
export function ShareButton({ title }: { title: string }) {
  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
      } else {
        await navigator.clipboard.writeText(url)
        toast.success("Lien copié dans le presse-papiers")
      }
    } catch {
      // Partage annulé par l'utilisateur
    }
  }

  return (
    <Button type="button" variant="outline" className="rounded-full" onClick={share}>
      <Share2 className="size-4" /> Partager
    </Button>
  )
}
