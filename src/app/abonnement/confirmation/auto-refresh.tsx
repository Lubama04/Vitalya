"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

/** Relit l'état du paiement toutes les 5 s (au plus 3 minutes) tant qu'il est en attente. */
export function AutoRefresh() {
  const router = useRouter()
  const [attempts, setAttempts] = useState(0)

  useEffect(() => {
    if (attempts >= 36) return
    const timer = window.setTimeout(() => {
      setAttempts((value) => value + 1)
      router.refresh()
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [attempts, router])

  return attempts >= 36 ? (
    <p className="mt-4 text-sm text-muted-foreground">
      La confirmation prend plus de temps que prévu. Vous recevrez un email dès qu&apos;elle arrivera ; vous pouvez fermer cette page.
    </p>
  ) : null
}
