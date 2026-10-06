"use client"

import { useActionState, useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ExternalLink, ImagePlus, Loader2, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { saveArticle } from "@/actions/admin"
import { initialActionState } from "@/actions/types"
import { MarkdownEditor } from "@/components/admin/editor/markdown-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ACCESS_LABELS, ACCESS_LEVELS, slugify, type AccessLevel } from "@/lib/constants"
import { createClient } from "@/lib/supabase/client"

export type EditableArticle = {
  id?: string
  title: string
  subtitle: string
  slug: string
  content: string
  coverImage: string
  category: string
  accessLevel: AccessLevel
  published: boolean
  publishedAt: string | null
}

const COVER_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"]
const COVER_MAX_SIZE = 5 * 1024 * 1024

/** ISO → valeur d'un champ datetime-local (heure locale du navigateur). */
function toLocalInput(iso: string | null): string {
  const date = iso ? new Date(iso) : new Date()
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function ArticleEditor({
  article,
  categories,
  canDelete,
  deleteAction,
}: {
  article: EditableArticle
  categories: { id: string; name: string }[]
  canDelete: boolean
  deleteAction?: (formData: FormData) => Promise<void>
}) {
  const [state, formAction, pending] = useActionState(saveArticle, initialActionState)
  const [title, setTitle] = useState(article.title)
  const [slug, setSlug] = useState(article.slug)
  const [slugTouched, setSlugTouched] = useState(Boolean(article.id))
  const [content, setContent] = useState(article.content)
  const [category, setCategory] = useState(article.category)
  const [coverImage, setCoverImage] = useState(article.coverImage)
  const [published, setPublished] = useState(article.published)
  // Calculé côté navigateur uniquement (fuseau horaire local) pour éviter un écart d'hydratation
  const [publishedAtLocal, setPublishedAtLocal] = useState("")
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    setPublishedAtLocal(toLocalInput(article.publishedAt))
  }, [article.publishedAt])

  useEffect(() => {
    if (state.status === "success") toast.success(state.message)
    if (state.status === "error") toast.error(state.message)
  }, [state])

  function onTitleChange(value: string) {
    setTitle(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  async function uploadCover(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!COVER_TYPES.includes(file.type)) return toast.error("Format accepté : JPEG, PNG, WebP ou AVIF.")
    if (file.size > COVER_MAX_SIZE) return toast.error("Image trop lourde (5 Mo maximum).")

    setUploading(true)
    try {
      const supabase = createClient()
      // Nom de fichier généré : le nom d'origine n'est jamais conservé
      const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg"
      const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${extension}`
      const { error } = await supabase.storage.from("covers").upload(path, file, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      })
      if (error) throw error
      setCoverImage(supabase.storage.from("covers").getPublicUrl(path).data.publicUrl)
      toast.success("Image importée")
    } catch {
      toast.error("Import impossible. Vérifiez vos droits et réessayez.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <form action={formAction} className="space-y-6">
      {article.id && <input type="hidden" name="id" value={article.id} />}
      <input type="hidden" name="coverImage" value={coverImage} />
      <input type="hidden" name="publishedAt" value={published && publishedAtLocal ? new Date(publishedAtLocal).toISOString() : ""} />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        {/* ─── Titre, chapô, slug ─── */}
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">Titre</Label>
            <Input id="title" name="title" value={title} onChange={(event) => onTitleChange(event.target.value)} required maxLength={200} className="h-12 font-heading text-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subtitle">Sous-titre (chapô)</Label>
            <Textarea id="subtitle" name="subtitle" defaultValue={article.subtitle} maxLength={400} rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug (URL)</Label>
            <div className="flex items-center rounded-md border bg-muted/40 pl-3 text-sm text-muted-foreground focus-within:ring-2 focus-within:ring-ring/50">
              /articles/
              <input
                id="slug"
                name="slug"
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true)
                  setSlug(slugify(event.target.value))
                }}
                required
                maxLength={120}
                className="h-10 flex-1 bg-transparent pr-3 text-nuit outline-none"
              />
            </div>
          </div>
        </div>

        {/* ─── Publication et classement ─── */}
        <div className="space-y-4 rounded-2xl border bg-white p-5">
          <div className="flex items-center justify-between">
            <Label htmlFor="published">Publié</Label>
            <Switch id="published" name="published" checked={published} onCheckedChange={setPublished} />
          </div>
          {published && (
            <div className="space-y-1.5">
              <Label htmlFor="publishedAtLocal">Date de publication</Label>
              <Input id="publishedAtLocal" type="datetime-local" value={publishedAtLocal} onChange={(event) => setPublishedAtLocal(event.target.value)} />
              <p className="text-xs text-muted-foreground">Une date future programme la publication.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="category">Rubrique</Label>
              <select id="category" name="category" value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 w-full rounded-md border bg-white px-2 text-sm">
                <option value="">— Aucune —</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accessLevel">Accès</Label>
              <select id="accessLevel" name="accessLevel" defaultValue={article.accessLevel} className="h-10 w-full rounded-md border bg-white px-2 text-sm">
                {ACCESS_LEVELS.map((level) => (
                  <option key={level} value={level}>{ACCESS_LABELS[level]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Couverture</p>
            <div className="flex items-center gap-3">
              <div className="relative aspect-[16/10] w-28 shrink-0 overflow-hidden rounded-lg bg-muted">
                {coverImage && <Image src={coverImage} alt="" fill sizes="112px" className="object-cover" />}
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-2 py-2 text-xs font-medium hover:bg-vert-pale">
                  {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
                  {uploading ? "Import…" : coverImage ? "Remplacer" : "Importer"}
                  <input type="file" accept={COVER_TYPES.join(",")} onChange={uploadCover} className="sr-only" disabled={uploading} />
                </label>
                {coverImage && (
                  <button type="button" onClick={() => setCoverImage("")} className="text-xs text-red-600 hover:underline">Retirer</button>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={pending || uploading} className="h-10 flex-1 bg-vert-fonce hover:bg-vert-fonce/90">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {published ? "Publier" : "Enregistrer"}
            </Button>
            {article.id && (
              <Button asChild variant="outline" className="h-10" aria-label="Voir l'article">
                <Link href={`/articles/${article.slug}`} target="_blank">
                  <ExternalLink className="size-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Contenu : éditeur enrichi + aperçu ─── */}
      <section aria-labelledby="titre-contenu" className="space-y-2">
        <h2 id="titre-contenu" className="font-sans text-sm font-medium">Contenu</h2>
        <MarkdownEditor value={content} onChange={setContent} categoryId={category || undefined} />
        <p className="text-xs text-muted-foreground">
          Le paywall montre les 3 premiers paragraphes aux non-abonnés : placez le <code>Chapeau</code> et l&apos;accroche en tête.
          Raccourcis : Ctrl+B gras · Ctrl+I italique · Ctrl+K lien · Ctrl+Z annuler.
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button type="submit" disabled={pending || uploading} className="h-11 bg-vert-fonce px-6 hover:bg-vert-fonce/90">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {published ? "Enregistrer et publier" : "Enregistrer le brouillon"}
        </Button>
        {canDelete && article.id && deleteAction && (
          <Button
            type="submit"
            formAction={deleteAction}
            formNoValidate
            variant="destructive"
            onClick={(event) => {
              if (!window.confirm("Supprimer définitivement cet article et ses commentaires ?")) event.preventDefault()
            }}
          >
            <Trash2 className="size-4" /> Supprimer l&apos;article
          </Button>
        )}
      </div>
    </form>
  )
}
