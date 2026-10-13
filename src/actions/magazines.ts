"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { fail, ok, type ActionState } from "@/actions/types"
import { getViewer } from "@/lib/auth"
import { isAllowedImageUrl } from "@/lib/mdx/urls"
import { createClient } from "@/lib/supabase/server"

// Numéros du magazine : création et modification réservées aux administrateurs (RLS).

const imageUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((value) => value === "" || isAllowedImageUrl(value), "Adresse d'image invalide (https:// ou fichier du site).")

const editionSchema = z.object({
  id: z.uuid().optional(),
  numero: z.coerce.number().int("Numéro invalide").min(1, "Numéro invalide").max(9999),
  titre: z.string().trim().min(3, "Titre trop court").max(200, "Titre trop long"),
  datePublication: z.iso.date("Date de publication invalide"),
  articleIds: z
    .string()
    .transform((value, context) => {
      try {
        const parsed: unknown = JSON.parse(value || "[]")
        const ids = z.array(z.uuid()).max(60).parse(parsed)
        return [...new Set(ids)]
      } catch {
        context.addIssue({ code: "custom", message: "Sélection d'articles invalide." })
        return z.NEVER
      }
    }),
  couvertureUrl: imageUrl,
  couverturePdfUrl: imageUrl,
  couvertureComplete: z.boolean(),
})

async function assertAdmin() {
  const viewer = await getViewer()
  return viewer?.role === "admin" ? viewer : null
}

export async function saveEdition(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await assertAdmin())) return fail("Accès réservé aux administrateurs.")
  const parsed = editionSchema.safeParse({
    id: formData.get("id") || undefined,
    numero: formData.get("numero"),
    titre: formData.get("titre"),
    datePublication: formData.get("datePublication"),
    articleIds: formData.get("articleIds") ?? "[]",
    couvertureUrl: formData.get("couvertureUrl") ?? "",
    couverturePdfUrl: formData.get("couverturePdfUrl") ?? "",
    couvertureComplete: formData.get("couvertureComplete") === "on",
  })
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  const data = parsed.data

  const row = {
    numero: data.numero,
    titre: data.titre,
    date_publication: data.datePublication,
    article_ids: data.articleIds,
    couverture_url: data.couvertureUrl || null,
    couverture_pdf_url: data.couverturePdfUrl || null,
    couverture_complete: data.couvertureComplete,
  }
  const supabase = await createClient()
  const result = data.id
    ? await supabase.from("magazine_editions").update(row).eq("id", data.id).select("id").single()
    : await supabase.from("magazine_editions").insert(row).select("id").single()
  if (result.error) {
    if (result.error.code === "23505") return fail(`Le numéro ${data.numero} existe déjà.`)
    console.error("saveEdition", result.error.message)
    return fail("Enregistrement impossible.")
  }

  revalidatePath("/admin/magazines")
  revalidatePath("/magazine")
  if (!data.id) redirect(`/admin/magazines/${result.data.id}?cree=1`)
  return ok("Numéro enregistré. Le PDF sera régénéré au prochain téléchargement.")
}

export async function deleteEdition(formData: FormData): Promise<void> {
  if (!(await assertAdmin())) redirect("/admin/magazines")
  const id = z.uuid().safeParse(formData.get("id"))
  if (id.success) {
    const supabase = await createClient()
    await supabase.from("magazine_editions").delete().eq("id", id.data)
    revalidatePath("/magazine")
  }
  redirect("/admin/magazines")
}
