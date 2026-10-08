"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { safeRedirectPath } from "@/lib/auth"
import { siteUrl } from "@/lib/env"
import { sendEmail } from "@/lib/email"
import { welcomeEmailHtml } from "@/lib/newsletter-email"
import { fail, ok, type ActionState } from "@/actions/types"

const emailSchema = z.email("Adresse email invalide").max(254).transform((v) => v.trim().toLowerCase())
const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères")
  .max(72, "Mot de passe trop long")

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Mot de passe requis").max(72),
  next: z.string().optional(),
})

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Indiquez votre nom").max(120),
  email: emailSchema,
  password: passwordSchema,
  next: z.string().optional(),
})

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides")

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    // Message volontairement générique (pas d'énumération des comptes)
    if (error.code === "email_not_confirmed") {
      return fail("Veuillez confirmer votre adresse email avant de vous connecter.")
    }
    return fail("Email ou mot de passe incorrect.")
  }

  revalidatePath("/", "layout")
  redirect(safeRedirectPath(parsed.data.next, "/profil"))
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides")

  const next = safeRedirectPath(parsed.data.next, "/profil")
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  })

  if (error) {
    if (error.code === "weak_password") return fail("Mot de passe trop faible : choisissez-en un plus robuste.")
    if (error.code === "over_email_send_rate_limit") {
      return fail("Trop de tentatives. Réessayez dans quelques minutes.")
    }
    console.error("signUp", error.code, error.message)
    return fail("Inscription impossible pour le moment. Réessayez plus tard.")
  }

  // Email de bienvenue, uniquement pour un compte réellement créé : pour une adresse
  // déjà inscrite, Supabase renvoie un utilisateur sans identité (aucun envoi, pas d'énumération).
  // Envoyé après la réponse pour ne pas ralentir l'inscription.
  if (data.user && (data.user.identities?.length ?? 0) > 0) {
    const { email, fullName } = parsed.data
    after(async () => {
      await sendEmail({ to: email, subject: "Bienvenue chez Vitalya 🌿", html: welcomeEmailHtml({ siteUrl, name: fullName }) })
    })
  }

  // Confirmation d'email désactivée : session immédiate
  if (data.session) {
    revalidatePath("/", "layout")
    redirect(next)
  }

  return ok("Compte créé ! Consultez votre boîte mail pour confirmer votre adresse.")
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = emailSchema.safeParse(formData.get("email"))
  if (!parsed.success) return fail("Adresse email invalide")

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${siteUrl}/auth/callback?next=/profil/mot-de-passe`,
  })
  if (error) console.error("resetPassword", error.code, error.message)

  // Réponse identique que le compte existe ou non
  return ok("Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé.")
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = passwordSchema.safeParse(formData.get("password"))
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Mot de passe invalide")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail("Session expirée, reconnectez-vous.")

  const { error } = await supabase.auth.updateUser({ password: parsed.data })
  if (error) {
    if (error.code === "same_password") return fail("Choisissez un mot de passe différent de l'actuel.")
    return fail("Mise à jour impossible. Réessayez.")
  }
  return ok("Mot de passe mis à jour.")
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/")
}
