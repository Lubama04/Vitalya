import Link from "next/link"
import { XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PaymentFailed() {
  return (
    <>
      <XCircle className="size-14 text-destructive" aria-hidden />
      <h1 className="mt-6 text-3xl font-bold text-nuit">Paiement non abouti</h1>
      <p className="mt-3 text-muted-foreground">
        Aucun montant n&apos;a été validé. Vous pouvez réessayer, avec le même moyen de paiement ou un autre (Mobile Money ou carte bancaire).
      </p>
      <Button asChild className="mt-8 bg-orange text-nuit hover:bg-orange/90">
        <Link href="/abonnement">Réessayer</Link>
      </Button>
    </>
  )
}
