import "server-only"
import { sendEmails } from "@/lib/email"
import { siteUrl } from "@/lib/env"
import { paidWelcomeEmailHtml, paymentConfirmationHtml } from "@/lib/newsletter-email"
import { confirmPaymentViaEdge, type ConfirmOutcome, type PaymentProvider } from "@/lib/payments/edge"
import { createPublicClient } from "@/lib/supabase/public"

export type { PaymentProvider }
export type PaymentOutcome = ConfirmOutcome

const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  pawapay: "Mobile Money (PawaPay)",
  moneyfusion: "MoneyFusion",
}

const TIER_LABELS: Record<string, string> = { premium: "Premium", expert: "Expert" }

/**
 * Vérifie un paiement auprès du prestataire et active l'abonnement (Edge Function confirm-payment),
 * puis envoie les emails : confirmation de paiement, et bienvenue pour un premier abonnement payant.
 * Point d'entrée unique des webhooks et de la page de confirmation ; idempotent
 * (les emails ne partent qu'à la première activation).
 */
export async function verifyAndConfirmPayment(provider: PaymentProvider, reference: string): Promise<PaymentOutcome> {
  const { outcome, payment } = await confirmPaymentViaEdge(provider, reference)

  if (outcome === "paid" && payment?.newly_activated && payment.user_email && payment.period_end) {
    const tier = TIER_LABELS[payment.tier] ?? payment.tier
    const { data: price } = await createPublicClient().rpc("subscription_price", { p_tier: payment.tier })
    const emails = [
      {
        to: payment.user_email,
        subject: "Votre abonnement Vitalya est actif ✅",
        html: paymentConfirmationHtml({
          siteUrl,
          name: payment.user_name,
          tier,
          amount: typeof price === "number" ? price : 0,
          currency: provider === "pawapay" ? "XAF" : "XOF",
          provider: PROVIDER_LABELS[provider],
          periodEnd: payment.period_end,
        }),
      },
    ]
    if (payment.first_subscription) {
      emails.push({
        to: payment.user_email,
        subject: `Bienvenue parmi les abonnés ${tier} de Vitalya 🌿`,
        html: paidWelcomeEmailHtml({ siteUrl, name: payment.user_name, tier }),
      })
    }
    await sendEmails(emails)
  }

  return outcome
}
