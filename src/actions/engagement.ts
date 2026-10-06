"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

const uuid = z.uuid()

/** Ajoute ou retire un « j'aime » ; renvoie le nouvel état. */
export async function toggleLike(articleId: string): Promise<Result<{ liked: boolean; count: number }>> {
  if (!uuid.safeParse(articleId).success) return { ok: false, error: "Article invalide" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Connectez-vous pour aimer cet article." }

  const { data: existing } = await supabase
    .from("likes")
    .select("id")
    .eq("article_id", articleId)
    .eq("user_id", user.id)
    .maybeSingle()

  const { error } = existing
    ? await supabase.from("likes").delete().eq("id", existing.id)
    : await supabase.from("likes").insert({ article_id: articleId, user_id: user.id })

  if (error) {
    console.error("toggleLike", error.message)
    return { ok: false, error: "Action impossible pour le moment." }
  }

  const { data: stats } = await supabase.rpc("get_article_stats", { p_article_id: articleId }).maybeSingle()
  return { ok: true, data: { liked: stats?.liked_by_me ?? !existing, count: stats?.likes_count ?? 0 } }
}

const commentSchema = z.object({
  articleId: uuid,
  content: z
    .string()
    .trim()
    .min(2, "Votre commentaire est trop court.")
    .max(2000, "Votre commentaire dépasse 2 000 caractères."),
})

export async function addComment(articleId: string, content: string): Promise<Result<null>> {
  const parsed = commentSchema.safeParse({ articleId, content })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Commentaire invalide" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Connectez-vous pour commenter." }

  const { error } = await supabase.from("comments").insert({
    article_id: parsed.data.articleId,
    user_id: user.id,
    content: parsed.data.content,
  })
  if (error) {
    console.error("addComment", error.message)
    return { ok: false, error: "Impossible de publier votre commentaire." }
  }
  return { ok: true, data: null }
}

export async function deleteComment(commentId: string): Promise<Result<null>> {
  if (!uuid.safeParse(commentId).success) return { ok: false, error: "Commentaire invalide" }

  const supabase = await createClient()
  // La RLS n'autorise la suppression qu'à l'auteur ou à l'équipe éditoriale
  const { error, count } = await supabase.from("comments").delete({ count: "exact" }).eq("id", commentId)
  if (error || count === 0) return { ok: false, error: "Suppression impossible." }
  return { ok: true, data: null }
}
