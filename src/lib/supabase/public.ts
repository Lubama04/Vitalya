import "server-only"
import { createClient } from "@supabase/supabase-js"
import { publicEnv } from "@/lib/env"
import type { Database } from "@/types/database"

/**
 * Client Supabase « visiteur anonyme », sans cookies.
 * Pour les données publiques (rubriques, listes d'articles publiés, auteurs) :
 * ne dépendant pas de la session, les pages qui l'utilisent restent
 * statiques / mises en cache (ISR) au lieu d'être rendues à chaque requête.
 * Mêmes droits que la clé publique : la RLS s'applique.
 */
let client: ReturnType<typeof createClient<Database>> | null = null

export function createPublicClient() {
  client ??= createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}
