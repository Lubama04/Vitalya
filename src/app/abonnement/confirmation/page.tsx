import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { AutoRefresh } from "./auto-refresh"
import { PaymentFailed } from "./payment-failed"
import { RedirectToProfile } from "./redirect-to-profile"
import { Button } from "@/components/ui/button"
import { requireViewer } from "@/lib/auth"
import { formatDate } from "@/lib/constants"
import { verifyAndConfirmPayment } from "@/lib/payments/confirm"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Confirmation du paiement", robots: { index: false, follow: false } }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLUMNS = "id, tier, status, payment_provider, pawapay_checkout_id, moneyfusion_token, current_period_end"

/**
 * Retour du lecteur après la page de paiement (PawaPay ou MoneyFusion).
 * L'état est vérifié auprès du prestataire (Edge Function confirm-payment) si le webhook
 * n'est pas encore passé ; en attente, la page se relit toutes les 5 secondes.
 */
export default async function PaymentConfirmationPage({ searchParams }: { searchParams: Promise<{ paiement?: string }> }) {
  const { paiement } = await searchParams
  const viewer = await requireViewer("/abonnement")
  const supabase = await createClient()

  // Paiement désigné dans l'URL, sinon le dernier paiement ouvert du lecteur (moins d'une heure)
  const select = () =>
    paiement && UUID.test(paiement)
      ? supabase.from("subscriptions").select(COLUMNS).eq("id", paiement).eq("user_id", viewer.id).maybeSingle()
      : supabase
          .from("subscriptions")
          .select(COLUMNS)
          .eq("user_id", viewer.id)
          .in("payment_provider", ["pawapay", "moneyfusion"])
          .gte("created_at", new Date(Date.now() - 3600_000).toISOString())
          .neq("status", "failed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

  let { data: payment } = await select()

  if (payment?.status === "incomplete") {
    const provider = payment.payment_provider
    const reference = provider === "pawapay" ? payment.pawapay_checkout_id : provider === "moneyfusion" ? payment.moneyfusion_token : null
    if (reference && (provider === "pawapay" || provider === "moneyfusion")) {
      const outcome = await verifyAndConfirmPayment(provider, reference)
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
          <p className="mt-3 text-muted-foreground">Ce lien ne correspond à aucun paiement récent de votre compte.</p>
          <Button asChild className="mt-8 bg-vert-fonce hover:bg-vert-fonce/90">
            <Link href="/abonnement">Voir les formules</Link>
          </Button>
        </>
      ) : payment.status === "active" ? (
        <>
          <CheckCircle2 className="size-14 text-vert-emeraude" aria-hidden />
          <h1 className="mt-6 text-3xl font-bold text-nuit">Félicitations, bienvenue en {tierLabel} !</h1>
          <p className="mt-3 text-muted-foreground">
            Votre paiement est confirmé et votre accès {tierLabel} est débloqué jusqu&apos;au {formatDate(payment.current_period_end)}. Un
            email de confirmation vous a été envoyé.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild className="bg-orange text-nuit hover:bg-orange/90">
              <Link href="/profil">Mon espace</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/articles">Lire les articles</Link>
            </Button>
          </div>
          <RedirectToProfile />
        </>
      ) : payment.status === "incomplete" ? (
        <div role="status" aria-live="polite" className="flex flex-col items-center">
          <Loader2 className="size-14 animate-spin text-vert-emeraude" aria-hidden />
          <h1 className="mt-6 text-3xl font-bold text-nuit">Vérification du paiement…</h1>
          <p className="mt-3 text-muted-foreground">
            Validez la demande sur votre téléphone si ce n&apos;est pas déjà fait. Nous vérifions votre paiement toutes les 5 secondes.
          </p>
          <AutoRefresh />
        </div>
      ) : (
        <PaymentFailed />
      )}
    </div>
  )
}
