import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2, Clock, XCircle } from "lucide-react"
import { AutoRefresh } from "./auto-refresh"
import { Button } from "@/components/ui/button"
import { requireViewer } from "@/lib/auth"
import { formatDate } from "@/lib/constants"
import { verifyAndConfirmPayment } from "@/lib/payments/confirm"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Paiement", robots: { index: false, follow: false } }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Retour du lecteur après la page de paiement (PawaPay ou MoneyFusion).
 * Si le webhook n'est pas encore passé, l'état est vérifié ici auprès du prestataire.
 */
export default async function PaymentReturnPage({ searchParams }: { searchParams: Promise<{ paiement?: string }> }) {
  const { paiement } = await searchParams
  const viewer = await requireViewer("/abonnement")
  const supabase = await createClient()

  const select = () =>
    supabase
      .from("subscriptions")
      .select("id, tier, status, payment_provider, pawapay_checkout_id, moneyfusion_token, current_period_end")
      .eq("id", paiement ?? "")
      .eq("user_id", viewer.id)
      .maybeSingle()

  let { data: payment } = paiement && UUID.test(paiement) ? await select() : { data: null }

  // Paiement encore ouvert : vérification immédiate auprès du prestataire
  if (payment?.status === "incomplete") {
    const reference =
      payment.payment_provider === "pawapay" ? payment.pawapay_checkout_id : payment.payment_provider === "moneyfusion" ? payment.moneyfusion_token : null
    if (reference && (payment.payment_provider === "pawapay" || payment.payment_provider === "moneyfusion")) {
      const outcome = await verifyAndConfirmPayment(payment.payment_provider, reference)
      if (outcome === "paid" || outcome === "failed") ({ data: payment } = await select())
    }
  }

  const tierLabel = payment?.tier === "expert" ? "Expert" : "Premium"

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      {!payment ? (
        <>
          <XCircle className="size-14 text-muted-foreground" aria-hidden />
          <h1 className="mt-6 text-3xl font-bold text-nuit">Paiement introuvable</h1>
          <p className="mt-3 text-muted-foreground">Ce lien de paiement ne correspond à aucun paiement de votre compte.</p>
          <Button asChild className="mt-8 bg-vert-fonce hover:bg-vert-fonce/90">
            <Link href="/abonnement">Voir les formules</Link>
          </Button>
        </>
      ) : payment.status === "active" ? (
        <>
          <CheckCircle2 className="size-14 text-vert-emeraude" aria-hidden />
          <h1 className="mt-6 text-3xl font-bold text-nuit">Bienvenue en {tierLabel} !</h1>
          <p className="mt-3 text-muted-foreground">
            Votre paiement est confirmé. Accès {tierLabel} jusqu&apos;au {formatDate(payment.current_period_end)}. Un email de confirmation vous a été envoyé.
          </p>
          <Button asChild className="mt-8 bg-orange text-nuit hover:bg-orange/90">
            <Link href="/articles">Lire les articles</Link>
          </Button>
        </>
      ) : payment.status === "incomplete" ? (
        <div role="status" aria-live="polite" className="flex flex-col items-center">
          <Clock className="size-14 animate-pulse text-or" aria-hidden />
          <h1 className="mt-6 text-3xl font-bold text-nuit">Paiement en cours de confirmation…</h1>
          <p className="mt-3 text-muted-foreground">
            Validez la demande sur votre téléphone si ce n&apos;est pas déjà fait. Cette page se met à jour automatiquement.
          </p>
          <AutoRefresh />
        </div>
      ) : (
        <>
          <XCircle className="size-14 text-destructive" aria-hidden />
          <h1 className="mt-6 text-3xl font-bold text-nuit">Paiement non abouti</h1>
          <p className="mt-3 text-muted-foreground">Aucun montant n&apos;a été validé. Vous pouvez réessayer, avec le même moyen de paiement ou un autre.</p>
          <Button asChild className="mt-8 bg-orange text-nuit hover:bg-orange/90">
            <Link href="/abonnement">Réessayer</Link>
          </Button>
        </>
      )}
    </div>
  )
}
