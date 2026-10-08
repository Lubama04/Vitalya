"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { Loader2, MessageCircle, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { addComment, deleteComment } from "@/actions/engagement"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { loadSupabase } from "@/lib/supabase/lazy"

export type CommentItem = {
  id: string
  content: string
  created_at: string
  user_id: string
  author_name: string
  author_avatar: string | null
}

const relative = new Intl.RelativeTimeFormat("fr", { numeric: "auto" })

function timeAgo(iso: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [30, "day"],
    [12, "month"],
  ]
  let value = seconds
  for (const [size, unit] of steps) {
    if (Math.abs(value) < size) return relative.format(value, unit)
    value = Math.round(value / size)
  }
  return relative.format(value, "year")
}

export function Comments({
  articleId,
  initialComments,
  viewerId,
  canModerate,
}: {
  articleId: string
  initialComments: CommentItem[]
  viewerId: string | null
  canModerate: boolean
}) {
  const [comments, setComments] = useState(initialComments)
  const [content, setContent] = useState("")
  const [pending, startTransition] = useTransition()

  const refresh = useCallback(async () => {
    const supabase = await loadSupabase()
    const { data } = await supabase.rpc("get_article_comments", { p_article_id: articleId })
    if (data) setComments(data)
  }, [articleId])

  // Temps réel : rechargement à chaque nouveau commentaire / suppression
  // (client chargé après l'affichage, lorsque le navigateur est inactif)
  useEffect(() => {
    let cancelled = false
    let cleanup: (() => void) | undefined
    const start = () =>
      void loadSupabase().then((supabase) => {
        if (cancelled) return
        const channel = supabase
          .channel(`comments:${articleId}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "comments", filter: `article_id=eq.${articleId}` },
            () => void refresh(),
          )
          .subscribe()
        cleanup = () => void supabase.removeChannel(channel)
      })
    // requestIdleCallback absent de certains Safari : repli sur un délai simple
    const idleApi = window.requestIdleCallback as typeof window.requestIdleCallback | undefined
    const handle = idleApi ? idleApi(start, { timeout: 4000 }) : window.setTimeout(start, 2000)
    return () => {
      cancelled = true
      if (idleApi) window.cancelIdleCallback(handle)
      else window.clearTimeout(handle)
      cleanup?.()
    }
  }, [articleId, refresh])

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await addComment(articleId, content)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setContent("")
      toast.success("Commentaire publié")
      await refresh()
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteComment(id)
      if (!result.ok) toast.error(result.error)
      else setComments((current) => current.filter((comment) => comment.id !== id))
    })
  }

  return (
    <section aria-labelledby="titre-commentaires" className="mt-16">
      <h2 id="titre-commentaires" className="flex items-center gap-2 text-2xl font-bold text-nuit">
        <MessageCircle className="size-6 text-vert-emeraude" aria-hidden />
        Commentaires <span className="text-base font-normal text-muted-foreground">({comments.length})</span>
      </h2>

      {viewerId ? (
        <form onSubmit={submit} className="mt-6 space-y-3">
          <label htmlFor="comment" className="sr-only">Votre commentaire</label>
          <Textarea
            id="comment"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Partagez votre expérience ou posez une question…"
            maxLength={2000}
            rows={4}
            className="resize-y"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{content.length}/2000</span>
            <Button type="submit" disabled={pending || content.trim().length < 2} className="bg-vert-fonce hover:bg-vert-fonce/90">
              {pending && <Loader2 className="size-4 animate-spin" />} Publier
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-6 rounded-xl bg-vert-pale/50 p-5 text-sm">
          <Link href="/auth" className="font-semibold text-vert-fonce underline">Connectez-vous</Link> pour
          rejoindre la conversation.
        </p>
      )}

      <ul className="mt-8 space-y-6">
        {comments.map((comment) => (
          <li key={comment.id} className="flex gap-4">
            <Avatar className="size-10 shrink-0">
              {comment.author_avatar && <AvatarImage src={comment.author_avatar} alt="" />}
              <AvatarFallback className="bg-vert-pale text-sm font-semibold text-vert-fonce">
                {comment.author_name.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-nuit">{comment.author_name}</p>
                <time dateTime={comment.created_at} className="text-xs text-muted-foreground">
                  {timeAgo(comment.created_at)}
                </time>
                {(comment.user_id === viewerId || canModerate) && (
                  <button
                    type="button"
                    onClick={() => remove(comment.id)}
                    className="ml-auto rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    aria-label="Supprimer le commentaire"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
              {/* Rendu en texte brut : aucune injection HTML possible */}
              <p className="mt-1 whitespace-pre-line break-words text-nuit/85">{comment.content}</p>
            </div>
          </li>
        ))}
        {comments.length === 0 && (
          <li className="text-sm text-muted-foreground">Soyez la première personne à commenter cet article.</li>
        )}
      </ul>
    </section>
  )
}
