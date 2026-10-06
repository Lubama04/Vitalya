"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { Resend } from "resend"
import { z } from "zod"
import { getViewer, isStaff } from "@/lib/auth"
import { ACCESS_LEVELS, computeReadingTime, ROLES } from "@/lib/constants"
import { publicEnv, siteUrl } from "@/lib/env"
import { serverEnv } from "@/lib/env.server"
import { newsletterHtml } from "@/lib/newsletter-email"
import { createClient } from "@/lib/supabase/server"
import { fail, ok, type ActionState } from "@/actions/types"

// Chaque action revérifie le rôle côté serveur (la RLS est la seconde barrière).

async function assertStaff() {
  const viewer = await getViewer()
  if (!viewer || !isStaff(viewer)) return null
  return viewer
}

// ─── Articles ─────────────────────────────────────────────────

const coverPrefix = `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/`

const articleSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(3, "Titre trop court").max(200, "Titre trop long"),
  subtitle: z.string().trim().max(400, "Sous-titre trop long").optional(),
  slug: z
    .string()
    .trim()
    .max(120)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug invalide : minuscules, chiffres et tirets uniquement"),
  content: z.string().max(200000, "Contenu trop long"),
  coverImage: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => value === "" || /^\/covers\/[\w.-]+$/.test(value) || value.startsWith(coverPrefix),
      "L'image doit provenir du stockage Vitalya",
    ),
  category: z.union([z.uuid(), z.literal("")]),
  accessLevel: z.enum(ACCESS_LEVELS),
  published: z.boolean(),
  publishedAt: z.string().optional(),
})

export async function saveArticle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await assertStaff()
  if (!viewer) return fail("Accès refusé.")

  const parsed = articleSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    subtitle: formData.get("subtitle") || undefined,
    slug: formData.get("slug"),
    // Les formulaires envoient des fins de ligne CRLF : on normalise en LF
    // (le découpage de l'aperçu du paywall repose sur les lignes vides).
    content: String(formData.get("content") ?? "").replace(/\r\n?/g, "\n"),
    coverImage: formData.get("coverImage") ?? "",
    category: formData.get("category") ?? "",
    accessLevel: formData.get("accessLevel"),
    published: formData.get("published") === "on",
    publishedAt: formData.get("publishedAt") || undefined,
  })
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides")

  const data = parsed.data
  let publishedAt: string | null = null
  if (data.published) {
    const date = data.publishedAt ? new Date(data.publishedAt) : new Date()
    if (Number.isNaN(date.getTime())) return fail("Date de publication invalide")
    publishedAt = date.toISOString()
  }

  const row = {
    title: data.title,
    subtitle: data.subtitle ?? null,
    slug: data.slug,
    content: data.content,
    cover_image: data.coverImage || null,
    category: data.category || null,
    access_level: data.accessLevel,
    published: data.published,
    published_at: publishedAt,
    reading_time: computeReadingTime(data.content),
  }

  const supabase = await createClient()
  const result = data.id
    ? await supabase.from("articles").update(row).eq("id", data.id).select("id").single()
    : await supabase.from("articles").insert({ ...row, author_id: viewer.id }).select("id").single()

  if (result.error) {
    if (result.error.code === "23505") return fail("Ce slug est déjà utilisé par un autre article.")
    console.error("saveArticle", result.error.message)
    return fail("Enregistrement impossible.")
  }

  revalidatePath("/", "layout")
  if (!data.id) redirect(`/admin/articles/${result.data.id}?cree=1`)
  return ok(data.published ? "Article enregistré et publié." : "Brouillon enregistré.")
}

export async function deleteArticle(formData: FormData): Promise<void> {
  const viewer = await getViewer()
  const id = z.uuid().safeParse(formData.get("id"))
  if (viewer?.role !== "admin" || !id.success) redirect("/admin/articles")

  const supabase = await createClient()
  const { error } = await supabase.from("articles").delete().eq("id", id.data)
  if (error) console.error("deleteArticle", error.message)
  revalidatePath("/", "layout")
  redirect("/admin/articles")
}

// ─── Abonnés ──────────────────────────────────────────────────

const memberSchema = z.object({
  userId: z.uuid(),
  role: z.enum(ROLES),
  tier: z.enum(ACCESS_LEVELS),
})

export async function updateMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer()
  if (viewer?.role !== "admin") return fail("Réservé aux administrateurs.")

  const parsed = memberSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    tier: formData.get("tier"),
  })
  if (!parsed.success) return fail("Données invalides")

  const supabase = await createClient()
  const { error } = await supabase.rpc("admin_set_profile", {
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
    p_tier: parsed.data.tier,
  })
  if (error) {
    if (error.message.includes("cannot_demote_self")) return fail("Vous ne pouvez pas retirer votre propre rôle d'administrateur.")
    return fail("Mise à jour impossible.")
  }
  revalidatePath("/admin/abonnes")
  return ok("Membre mis à jour.")
}

// ─── Newsletter ───────────────────────────────────────────────

const newsletterSchema = z.object({
  subject: z.string().trim().min(3, "Objet trop court").max(200, "Objet trop long"),
  content: z.string().trim().min(10, "Contenu trop court").max(100000),
  mode: z.enum(["test", "envoi"]),
})

const BATCH_SIZE = 100

export async function sendNewsletter(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await assertStaff()
  if (!viewer) return fail("Accès refusé.")

  const parsed = newsletterSchema.safeParse({
    subject: formData.get("subject"),
    content: formData.get("content"),
    mode: formData.get("mode"),
  })
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides")

  if (!serverEnv.RESEND_API_KEY) {
    return fail("Resend n'est pas configuré : ajoutez RESEND_API_KEY dans les variables d'environnement.")
  }
  const resend = new Resend(serverEnv.RESEND_API_KEY)
  const { subject, content, mode } = parsed.data
  const supabase = await createClient()

  // Destinataires : l'éditeur seul (test) ou tous les abonnés actifs
  let recipients: { email: string; token: string }[]
  if (mode === "test") {
    recipients = [{ email: viewer.email, token: "00000000-0000-0000-0000-000000000000" }]
  } else {
    recipients = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("newsletter_subscribers")
        .select("email, unsubscribe_token")
        .is("unsubscribed_at", null)
        .order("created_at")
        .range(from, from + 999)
      if (error) return fail("Lecture des abonnés impossible.")
      recipients.push(...data.map((row) => ({ email: row.email, token: row.unsubscribe_token })))
      if (data.length < 1000) break
    }
    if (recipients.length === 0) return fail("Aucun abonné actif à la newsletter.")
  }

  let sent = 0
  for (let index = 0; index < recipients.length; index += BATCH_SIZE) {
    const batch = recipients.slice(index, index + BATCH_SIZE).map((recipient) => {
      const unsubscribeUrl = `${siteUrl}/newsletter/desinscription?token=${recipient.token}`
      return {
        from: serverEnv.RESEND_FROM_EMAIL,
        to: [recipient.email],
        subject: mode === "test" ? `[TEST] ${subject}` : subject,
        html: newsletterHtml({ subject, body: content, siteUrl, unsubscribeUrl }),
        headers: {
          "List-Unsubscribe": `<${siteUrl}/api/newsletter/desinscription?token=${recipient.token}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }
    })
    const { error } = await resend.batch.send(batch)
    if (error) {
      console.error("sendNewsletter", error.message)
      return fail(sent > 0 ? `Envoi interrompu après ${sent} emails.` : "Envoi impossible : vérifiez la configuration Resend.")
    }
    sent += batch.length
  }

  if (mode === "envoi") {
    await supabase.from("newsletters").insert({
      subject,
      content,
      sent_at: new Date().toISOString(),
      recipients_count: sent,
      created_by: viewer.id,
    })
    revalidatePath("/admin/newsletter")
    return ok(`Newsletter envoyée à ${sent} abonné·e·s.`)
  }
  return ok(`Email de test envoyé à ${viewer.email}.`)
}
