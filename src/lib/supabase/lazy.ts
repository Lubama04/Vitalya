import type { createClient } from "@/lib/supabase/client"

type BrowserClient = ReturnType<typeof createClient>

let clientPromise: Promise<BrowserClient> | null = null

/**
 * Client Supabase navigateur chargé à la demande : supabase-js (~50 kB gzip)
 * reste hors du JavaScript initial et n'est téléchargé qu'au premier usage.
 */
export function loadSupabase(): Promise<BrowserClient> {
  clientPromise ??= import("@/lib/supabase/client").then((mod) => mod.createClient())
  return clientPromise
}
