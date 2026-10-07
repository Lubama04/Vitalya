"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { fail, ok, type ActionState } from "@/actions/types"

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Nom trop court").max(120, "Nom trop long"),
})

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = profileSchema.safeParse({ fullName: formData.get("fullName") })
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail("Session expirée, reconnectez-vous.")

  // Seules les colonnes full_name / avatar_url sont modifiables (privilèges de colonnes)
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", user.id)
  if (error) {
    console.error("updateProfile", error.message)
    return fail("Mise à jour impossible.")
  }
  revalidatePath("/", "layout")
  return ok("Profil mis à jour.")
}

const pushSchema = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(10).max(100) }),
})

/** Enregistre un abonnement aux notifications push (préparé). */
export async function savePushSubscription(subscription: unknown): Promise<{ ok: boolean }> {
  const parsed = pushSchema.safeParse(subscription)
  if (!parsed.success) return { ok: false }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    },
    { onConflict: "endpoint" },
  )
  return { ok: !error }
}

export async function deletePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return { ok: false }
  const supabase = await createClient()
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint)
  return { ok: !error }
}

/** Mode de lecture préféré (colonne reading_mode, modifiable par le lecteur). */
export async function setReadingMode(mode: unknown): Promise<{ ok: boolean }> {
  const parsed = z.enum(["scroll", "book"]).safeParse(mode)
  if (!parsed.success) return { ok: false }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  const { error } = await supabase.from("profiles").update({ reading_mode: parsed.data }).eq("id", user.id)
  return { ok: !error }
}
