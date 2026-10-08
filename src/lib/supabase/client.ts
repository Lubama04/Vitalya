import { createBrowserClient } from "@supabase/ssr"
import { publicEnv } from "@/lib/env"
import type { Database } from "@/types/database"

/** Client Supabase côté navigateur (clé publique, soumis à la RLS). */
export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
