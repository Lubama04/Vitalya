"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <h1 className="text-3xl font-bold text-vert-fonce">Une erreur est survenue</h1>
      <p className="mt-3 text-muted-foreground">Veuillez réessayer dans quelques instants.</p>
      {error.digest && <p className="mt-2 text-xs text-muted-foreground">Référence : {error.digest}</p>}
      <Button onClick={reset} className="mt-8 bg-vert-fonce hover:bg-vert-fonce/90">
        Réessayer
      </Button>
    </div>
  )
}
