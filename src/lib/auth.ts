import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isAccessLevel, isReadingMode, isRole, type AccessLevel, type ReadingMode, type Role } from "@/lib/constants"

export type Viewer = {
  id: string
  email: string
  fullName: string | null
  avatarUrl: string | null
  tier: AccessLevel
  role: Role
  readingMode: ReadingMode
  createdAt: string
}

/**
 * Utilisateur courant + profil, mis en cache pour la durée de la requête.
 * Utilise getUser() qui valide le jeton auprès de Supabase.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Niveau effectif = profil OU abonnement payé non expiré (mobile money, carte…)
  const [{ data: profile }, { data: effectiveTier }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, subscription_tier, role, reading_mode, created_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.rpc("current_tier"),
  ])

  if (!profile) return null

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    avatarUrl: profile.avatar_url,
    tier: isAccessLevel(effectiveTier) ? effectiveTier : isAccessLevel(profile.subscription_tier) ? profile.subscription_tier : "free",
    role: isRole(profile.role) ? profile.role : "reader",
    readingMode: isReadingMode(profile.reading_mode) ? profile.reading_mode : "scroll",
    createdAt: profile.created_at,
  }
})

export function isStaff(viewer: Viewer | null): boolean {
  return viewer?.role === "admin" || viewer?.role === "editor"
}

/** Exige une session ; redirige vers /auth sinon. */
export async function requireViewer(next = "/profil"): Promise<Viewer> {
  const viewer = await getViewer()
  if (!viewer) redirect(`/auth?next=${encodeURIComponent(next)}`)
  return viewer
}

/** Exige un rôle éditorial (admin ou éditeur). */
export async function requireStaff(): Promise<Viewer> {
  const viewer = await requireViewer("/admin")
  if (!isStaff(viewer)) redirect("/")
  return viewer
}

/** Exige le rôle administrateur. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer("/admin")
  if (viewer.role !== "admin") redirect("/admin")
  return viewer
}

/** N'accepte que des chemins internes pour éviter les redirections ouvertes. */
export function safeRedirectPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback
  return value
}
