import "server-only"
import { serverEnv } from "@/lib/env.server"

// Client PawaPay API v2 (page de paiement hébergée « Checkout »).
// Documentation : https://docs.pawapay.io/v2/docs/checkouts

/** Pays desservis : Tchad et Cameroun (franc CFA BEAC, sans décimales). */
export const PAWAPAY_COUNTRIES = {
  TCD: { label: "Tchad", dialCode: "235", localDigits: 8, currency: "XAF" },
  CMR: { label: "Cameroun", dialCode: "237", localDigits: 9, currency: "XAF" },
} as const

export type PawapayCountry = keyof typeof PAWAPAY_COUNTRIES

export function isPawapayCountry(value: unknown): value is PawapayCountry {
  return value === "TCD" || value === "CMR"
}

export type PawapayProvider = { code: string; name: string; country: PawapayCountry }

async function pawapayFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!serverEnv.PAWAPAY_API_KEY) throw new Error("PawaPay non configuré")
  return fetch(`${serverEnv.PAWAPAY_BASE_URL.replace(/\/+$/, "")}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${serverEnv.PAWAPAY_API_KEY}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  })
}

type ActiveConf = {
  countries?: {
    country: string
    providers?: {
      provider: string
      displayName?: string
      currencies?: { currency: string; operationTypes?: { DEPOSIT?: { status?: string } } }[]
    }[]
  }[]
}

/**
 * Opérateurs ouverts aux dépôts pour un pays, lus dans la configuration du compte
 * (/v2/active-conf) : la liste suit automatiquement ce que PawaPay active.
 */
export async function getPawapayProviders(country: PawapayCountry): Promise<PawapayProvider[]> {
  try {
    const response = await pawapayFetch(`/v2/active-conf?country=${country}&operationType=DEPOSIT`)
    if (!response.ok) return []
    const conf = (await response.json()) as ActiveConf
    const currency = PAWAPAY_COUNTRIES[country].currency
    return (conf.countries ?? [])
      .filter((entry) => entry.country === country)
      .flatMap((entry) => entry.providers ?? [])
      .filter((provider) =>
        (provider.currencies ?? []).some(
          (item) => item.currency === currency && item.operationTypes?.DEPOSIT && item.operationTypes.DEPOSIT.status !== "CLOSED",
        ),
      )
      .map((provider) => ({ code: provider.provider, name: provider.displayName ?? provider.provider, country }))
  } catch (error) {
    console.error("getPawapayProviders", error instanceof Error ? error.message : error)
    return []
  }
}

export type CreateCheckoutResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; code: string; message: string }

/** Ouvre une page de paiement PawaPay (checkoutId = identifiant de notre paiement). */
export async function createPawapayCheckout(input: {
  checkoutId: string
  country: PawapayCountry
  amount: number
  phoneNumber: string
  provider: string
  returnUrl: string
}): Promise<CreateCheckoutResult> {
  const { checkoutId, country, amount, phoneNumber, provider, returnUrl } = input
  const currency = PAWAPAY_COUNTRIES[country].currency
  try {
    const response = await pawapayFetch("/v2/checkouts", {
      method: "POST",
      body: JSON.stringify({
        checkoutId,
        returnUrl,
        returnMethod: "COUNTDOWN",
        defaultLanguage: "fr",
        countries: [country],
        expiresAfter: 30,
        amounts: [{ country, currency, amount: String(amount) }],
        payer: { type: "MMO", accountDetails: { phoneNumber, provider, allowCustomerToOverride: true } },
        clientReferenceId: checkoutId,
        // 4 à 22 caractères, lettres, chiffres et espaces
        reason: { fr: "Abonnement Vitalya", en: "Vitalya subscription" },
      }),
    })
    const body = (await response.json().catch(() => null)) as {
      status?: string
      redirectUrl?: string
      failureReason?: { failureCode?: string; failureMessage?: string }
    } | null

    if (response.ok && (body?.status === "ACCEPTED" || body?.status === "DUPLICATE_IGNORED") && body.redirectUrl) {
      return { ok: true, redirectUrl: body.redirectUrl }
    }
    return {
      ok: false,
      code: body?.failureReason?.failureCode ?? `HTTP_${response.status}`,
      message: body?.failureReason?.failureMessage ?? "Paiement refusé par PawaPay",
    }
  } catch (error) {
    return { ok: false, code: "NETWORK", message: error instanceof Error ? error.message : "Erreur réseau" }
  }
}

export type CheckoutStatus = {
  status: "WAITING_PAYMENT" | "PROCESSING" | "COMPLETED" | "FAILED" | "EXPIRED" | "CANCELLED" | "UNKNOWN"
  /** Montant effectivement encaissé (dépôt réussi), en unités entières */
  paidAmount: number | null
  currency: string | null
}

/** État officiel d'une page de paiement, lu directement auprès de PawaPay. */
export async function getPawapayCheckout(checkoutId: string): Promise<CheckoutStatus | null> {
  try {
    const response = await pawapayFetch(`/v2/checkouts/${encodeURIComponent(checkoutId)}`)
    if (!response.ok) return null
    const body = (await response.json()) as {
      status?: string
      data?: { status?: string; deposit?: { status?: string; amount?: string; currency?: string } }
    }
    if (body.status !== "FOUND" || !body.data) return null
    const known = ["WAITING_PAYMENT", "PROCESSING", "COMPLETED", "FAILED", "EXPIRED", "CANCELLED"] as const
    const status = known.find((value) => value === body.data?.status) ?? "UNKNOWN"
    const deposit = body.data.deposit
    const paidAmount = deposit?.status === "COMPLETED" && deposit.amount ? Math.floor(Number(deposit.amount)) : null
    return { status, paidAmount: Number.isFinite(paidAmount) ? paidAmount : null, currency: deposit?.currency ?? null }
  } catch (error) {
    console.error("getPawapayCheckout", error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Numéro au format PawaPay (indicatif + numéro, chiffres uniquement).
 * Accepte « 66 12 34 56 », « +235 66123456 », « 00235… ». Retourne null si invalide.
 */
export function normalizePhone(raw: string, country: PawapayCountry): string | null {
  const { dialCode, localDigits } = PAWAPAY_COUNTRIES[country]
  let digits = raw.replace(/\D/g, "")
  if (digits.startsWith("00")) digits = digits.slice(2)
  if (digits.startsWith(dialCode) && digits.length === dialCode.length + localDigits) digits = digits.slice(dialCode.length)
  if (digits.length !== localDigits || digits.startsWith("0")) return null
  return `${dialCode}${digits}`
}
