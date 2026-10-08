import "server-only"
import { serverEnv } from "@/lib/env.server"

// PawaPay API v2 côté Next.js : liste des opérateurs ouverts (/v2/active-conf).
// L'ouverture et la vérification des paiements sont faites par les Edge Functions Supabase
// create-payment et confirm-payment. Documentation : https://docs.pawapay.io/v2/docs/checkouts

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
    if (!response.ok) {
      console.error("getPawapayProviders HTTP", response.status)
      return []
    }
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
