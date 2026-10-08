"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

/** Après un paiement confirmé : compte à rebours puis redirection vers le profil. */
export function RedirectToProfile({ seconds = 6 }: { seconds?: number }) {
  const router = useRouter()
  const [left, setLeft] = useState(seconds)

  useEffect(() => {
    if (left <= 0) {
      router.push("/profil")
      return
    }
    const timer = window.setTimeout(() => setLeft((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [left, router])

  return (
    <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
      Redirection vers votre espace dans {Math.max(left, 0)} s…
    </p>
  )
}
