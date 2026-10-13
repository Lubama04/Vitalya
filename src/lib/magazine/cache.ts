import "server-only"
import { publicEnv } from "@/lib/env"
import { serverEnv } from "@/lib/env.server"

// Cache des PDF du magazine : Edge Function « magazine-cache » (bucket privé « magazines-pdf »).
// Le serveur Vitalya s'authentifie avec le secret partagé ; le lecteur reçoit un lien signé de 5 minutes.

const FUNCTION_URL = `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/magazine-cache`
export const MAGAZINE_CACHE_SECONDS = 3600

async function call(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const secret = serverEnv.PAYMENT_WEBHOOK_SECRET
  if (!secret) return null
  try {
    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: { "x-payment-secret": secret, apikey: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    })
    return (await response.json().catch(() => null)) as Record<string, unknown> | null
  } catch (error) {
    console.error("magazine-cache", error instanceof Error ? error.message : error)
    return null
  }
}

/** Lien signé vers une version en cache de moins d'une heure, sinon null. */
export async function getCachedMagazine(path: string, filename: string): Promise<string | null> {
  const result = await call({ action: "get", path, filename, maxAgeSeconds: MAGAZINE_CACHE_SECONDS })
  return result?.hit === true && typeof result.url === "string" ? result.url : null
}

export async function storeCachedMagazine(path: string, pdf: Buffer): Promise<void> {
  const result = await call({ action: "put", path, data: pdf.toString("base64") })
  if (result?.stored !== true) console.error("magazine-cache put", result?.error ?? "échec")
}
