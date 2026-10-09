import "server-only"
import { serverEnv } from "@/lib/env.server"
import type { MobileMoneyCountry } from "@/lib/payments/countries"

// PawaPay API v2 côté Next.js : liste des opérateurs ouverts (/v2/active-conf).
// L'ouverture et la vérification des paiements sont faites par les Edge Functions Supabase
// create-payment et confirm-payment. Documentation : https://docs.pawapay.io/v2/docs/checkouts

export type PawapayProvider = { code: string; name: string }

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
export async function getPawapayProviders(country: Pick<MobileMoneyCountry, "alpha3" | "currency">): Promise<PawapayProvider[]> {
  if (!serverEnv.PAWAPAY_API_KEY) return []
  try {
    const response = await fetch(
      `${serverEnv.PAWAPAY_BASE_URL.replace(/\/+$/, "")}/v2/active-conf?country=${country.alpha3}&operationType=DEPOSIT`,
      {
        headers: { Authorization: `Bearer ${serverEnv.PAWAPAY_API_KEY}` },
        signal: AbortSignal.timeout(10000),
        // Configuration peu changeante : mise en cache 10 minutes
        next: { revalidate: 600 },
      },
    )
    if (!response.ok) {
      console.error("getPawapayProviders HTTP", response.status)
      return []
    }
    const conf = (await response.json()) as ActiveConf
    return (conf.countries ?? [])
      .filter((entry) => entry.country === country.alpha3)
      .flatMap((entry) => entry.providers ?? [])
      .filter((provider) =>
        (provider.currencies ?? []).some(
          (item) => item.currency === country.currency && item.operationTypes?.DEPOSIT && item.operationTypes.DEPOSIT.status !== "CLOSED",
        ),
      )
      .map((provider) => ({ code: provider.provider, name: provider.displayName ?? provider.provider }))
  } catch (error) {
    console.error("getPawapayProviders", error instanceof Error ? error.message : error)
    return []
  }
}
