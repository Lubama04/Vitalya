// Variables publiques : validées au chargement (échec explicite si absentes).
// Les références statiques à process.env.NEXT_PUBLIC_* sont nécessaires
// pour que Next.js les injecte dans le bundle client.
// Validation volontairement sans zod : ce module est aussi chargé dans le navigateur.

function requireUrl(name: string, value: string | undefined, fallback?: string): string {
  const candidate = value || fallback
  if (!candidate) throw new Error(`Variable d'environnement manquante : ${name}`)
  try {
    new URL(candidate)
  } catch {
    throw new Error(`Variable d'environnement invalide (URL attendue) : ${name}`)
  }
  return candidate
}

function requireKey(name: string, value: string | undefined): string {
  if (!value || value.length < 20) throw new Error(`Variable d'environnement manquante ou invalide : ${name}`)
  return value
}

export const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: requireUrl("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requireKey("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  NEXT_PUBLIC_SITE_URL: requireUrl("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL, "http://localhost:3000"),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined,
} as const

/** URL publique du site, sans barre oblique finale. */
export const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "")
