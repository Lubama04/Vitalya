import "server-only"
import { publicEnv } from "@/lib/env"
import { serverEnv } from "@/lib/env.server"

// Appels aux Edge Functions Supabase de paiement :
// - create-payment : ouverture du paiement, PawaPay puis bascule MoneyFusion (secrets côté Supabase)
// - confirm-payment : vérification auprès du prestataire et activation de l'abonnement

const FUNCTIONS_URL = `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`

export type PaymentProvider = "pawapay" | "moneyfusion"

export type CreatePaymentInput = {
  tier: "premium" | "expert"
  method: "mobile" | "card"
  // Code ISO 3166-1 alpha-2 (tous pays)
  country: string
  operator: string | null
  phone: string
  name: string
  origin: string
}

export type CreatePaymentResult =
  | { ok: true; provider: PaymentProvider; paymentId: string; redirectUrl: string }
  | { ok: false; error: "not_authenticated" | "too_many_payments" | "providers_unavailable" | "payment_error" }

export async function createPaymentViaEdge(accessToken: string, input: CreatePaymentInput): Promise<CreatePaymentResult> {
  try {
    const response = await fetch(`${FUNCTIONS_URL}/create-payment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      // PawaPay puis, au besoin, MoneyFusion : jusqu'à ~25 s dans le pire des cas
      signal: AbortSignal.timeout(40000),
      cache: "no-store",
    })
    const body = (await response.json().catch(() => null)) as {
      provider?: PaymentProvider
      paymentId?: string
      redirectUrl?: string
      error?: string
    } | null
    if (response.ok && body?.provider && body.paymentId && body.redirectUrl?.startsWith("https://")) {
      return { ok: true, provider: body.provider, paymentId: body.paymentId, redirectUrl: body.redirectUrl }
    }
    const error = body?.error
    if (error === "not_authenticated" || error === "too_many_payments" || error === "providers_unavailable") return { ok: false, error }
    console.error("create-payment", response.status, error)
    return { ok: false, error: "payment_error" }
  } catch (error) {
    console.error("create-payment", error instanceof Error ? error.message : error)
    return { ok: false, error: "providers_unavailable" }
  }
}

export type ConfirmedPayment = {
  payment_id: string
  user_email: string
  user_name: string | null
  tier: string
  period_end: string | null
  newly_activated: boolean
  first_subscription: boolean
  /** Montant et devise réellement facturés (devise locale pour le Mobile Money) */
  amount: number | null
  currency: string | null
}

/** unknown : référence inconnue ; rejected : montant insuffisant ; error : à réessayer */
export type ConfirmOutcome = "paid" | "failed" | "pending" | "unknown" | "rejected" | "error"

export async function confirmPaymentViaEdge(
  provider: PaymentProvider,
  reference: string,
): Promise<{ outcome: ConfirmOutcome; payment?: ConfirmedPayment }> {
  const secret = serverEnv.PAYMENT_WEBHOOK_SECRET
  if (!secret) return { outcome: "error" }
  try {
    const response = await fetch(`${FUNCTIONS_URL}/confirm-payment`, {
      method: "POST",
      headers: {
        "x-payment-secret": secret,
        apikey: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ provider, reference }),
      signal: AbortSignal.timeout(25000),
      cache: "no-store",
    })
    const body = (await response.json().catch(() => null)) as { outcome?: ConfirmOutcome; payment?: ConfirmedPayment } | null
    if (!body?.outcome) return { outcome: "error" }
    return { outcome: body.outcome, payment: body.payment }
  } catch (error) {
    console.error("confirm-payment", error instanceof Error ? error.message : error)
    return { outcome: "error" }
  }
}
