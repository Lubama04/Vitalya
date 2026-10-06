"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { fail, ok, type ActionState } from "@/actions/types"

const schema = z.object({
  email: z.email("Adresse email invalide").max(254),
  // Champ piège invisible : rempli uniquement par les robots
  website: z.string().max(0).optional(),
})

export async function subscribeToNewsletter(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    website: formData.get("website") ?? undefined,
  })
  if (!parsed.success) {
    // Robot détecté : réponse neutre
    if (parsed.error.issues.some((issue) => issue.path[0] === "website")) {
      return ok("Merci ! Vous êtes bien inscrit·e.")
    }
    return fail(parsed.error.issues[0]?.message ?? "Adresse email invalide")
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("subscribe_newsletter", { p_email: parsed.data.email })
  if (error) {
    console.error("subscribeToNewsletter", error.message)
    return fail("Inscription impossible pour le moment.")
  }
  return ok("Merci ! Vous êtes bien inscrit·e à la lettre Vitalya.")
}
