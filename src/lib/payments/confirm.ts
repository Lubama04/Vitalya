import "server-only"
import { sendEmail } from "@/lib/email"
import { siteUrl } from "@/lib/env"
import { serverEnv } from "@/lib/env.server"
import { paymentConfirmationHtml } from "@/lib/newsletter-email"
import { getMoneyFusionStatus } from "@/lib/payments/moneyfusion"
import { getPawapayCheckout } from "@/lib/payments/pawapay"
import { createPublicClient } from "@/lib/supabase/public"

export type PaymentProvider = "pawapay" | "moneyfusion"
/** unknown : référence inconnue ; rejected : montant encaissé insuffisant ; error : à réessayer */
export type PaymentOutcome = "paid" | "failed" | "pending" | "unknown" | "rejected" | "error"

const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  pawapay: "Mobile Money (PawaPay)",
  moneyfusion: "MoneyFusion",
}

const TIER_LABELS: Record<string, string> = { premium: "Premium", expert: "Expert" }

/**
 * Vérifie l'état d'un paiement AUPRÈS DU PRESTATAIRE puis l'enregistre en base.
 * Seul point d'entrée de l'activation : webhooks et page de retour l'utilisent,
 * aucune donnée envoyée par un tiers n'est crue sur parole.
 * Idempotent : un paiement déjà confirmé n'est ni prolongé ni notifié deux fois.
 */
export async function verifyAndConfirmPayment(provider: PaymentProvider, reference: string): Promise<PaymentOutcome> {
  const secret = serverEnv.PAYMENT_WEBHOOK_SECRET
  if (!secret) return "error"

  let status: "paid" | "failed" | "pending"
  let paidAmount: number | null = null

  if (provider === "pawapay") {
    const checkout = await getPawapayCheckout(reference)
    if (!checkout) return "error"
    if (checkout.status === "COMPLETED") {
      status = "paid"
      paidAmount = checkout.currency === "XAF" ? checkout.paidAmount : null
    } else if (checkout.status === "FAILED" || checkout.status === "EXPIRED" || checkout.status === "CANCELLED") {
      status = "failed"
    } else {
      status = "pending"
    }
  } else {
    const payment = await getMoneyFusionStatus(reference)
    if (!payment) return "error"
    status = payment.status === "paid" ? "paid" : payment.status === "failed" ? "failed" : "pending"
    paidAmount = payment.paidAmount
  }

  if (status === "pending") return "pending"

  const supabase = createPublicClient()
  const { data, error } = await supabase
    .rpc("confirm_payment", {
      p_secret: secret,
      p_provider: provider,
      p_reference: reference,
      p_status: status,
      p_paid_amount: paidAmount ?? 0,
    })
    .maybeSingle()

  if (error || !data) {
    console.error("confirm_payment", provider, error?.message ?? "aucune ligne")
    if (error?.message.includes("payment_not_found")) return "unknown"
    if (error?.message.includes("amount_mismatch")) return "rejected"
    return "error"
  }

  // Email de confirmation : uniquement à la première activation
  if (status === "paid" && data.newly_activated && data.user_email && data.period_end) {
    const { data: price } = await supabase.rpc("subscription_price", { p_tier: data.tier })
    const sent = await sendEmail({
      to: data.user_email,
      subject: "Votre abonnement Vitalya est actif ✅",
      html: paymentConfirmationHtml({
        siteUrl,
        name: data.user_name,
        tier: TIER_LABELS[data.tier] ?? data.tier,
        amount: typeof price === "number" ? price : paidAmount ?? 0,
        currency: provider === "pawapay" ? "XAF" : "XOF",
        provider: PROVIDER_LABELS[provider],
        periodEnd: data.period_end,
      }),
    })
    if (sent) await supabase.rpc("mark_payment_email_sent", { p_secret: secret, p_payment_id: data.payment_id })
  }

  return status
}
