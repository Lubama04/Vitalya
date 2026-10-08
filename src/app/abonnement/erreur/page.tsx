import type { Metadata } from "next"
import { PaymentFailed } from "@/app/abonnement/confirmation/payment-failed"

export const metadata: Metadata = { title: "Paiement non abouti", robots: { index: false, follow: false } }

/** Échec de paiement (lien direct ou renvoi depuis la page de confirmation). */
export default function PaymentErrorPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <PaymentFailed />
    </div>
  )
}
