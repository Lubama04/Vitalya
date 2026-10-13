"use client"

import { useActionState, useEffect, useState } from "react"
import { ContentImage } from "@/components/content-image"
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
import { MEDIA_RULES, uploadMedia, validateMedia } from "@/components/admin/editor/upload"
import { isAllowedImageUrl } from "@/lib/mdx/urls"

export type EditableArticle = {
  id?: string
  title: string
  subtitle: string
  slug: string
  content: string
  coverImage: string
  category: string
  authorProfileId: string
  accessLevel: AccessLevel
  published: boolean
  publishedAt: string | null
}


/** ISO → valeur d'un champ datetime-local (heure locale du navigateur). */
function toLocalInput(iso: string | null): string {
  const date = iso ? new Date(iso) : new Date()
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function ArticleEditor({
  article,
  categories,
  authors,
  canDelete,
  deleteAction,
}: {
  article: EditableArticle
  categories: { id: string; name: string }[]
  authors: { id: string; name: string }[]
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
    const invalid = validateMedia(file, "image")
    if (invalid) return toast.error(invalid)

    setUploading(true)
    try {
      // Envoi dans le bucket « article-media » (même stockage que les images du contenu)
      setCoverImage(await uploadMedia(file, "image"))
      toast.success("Image importée")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import impossible. Réessayez.")
    } finally {
      setUploading(false)
    }
  }

  // Couverture par adresse externe (Unsplash, etc.)
  const [coverUrlDraft, setCoverUrlDraft] = useState("")
  function applyCoverUrl() {
    const url = coverUrlDraft.trim()
    if (!isAllowedImageUrl(url)) return toast.error("Collez une adresse d'image complète commençant par https://")
    setCoverImage(url)
    setCoverUrlDraft("")
    toast.success("Couverture mise à jour")
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
                <option value="">Aucune</option>
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

          <div className="space-y-1.5">
            <Label htmlFor="authorProfileId">Auteur</Label>
            <select id="authorProfileId" name="authorProfileId" defaultValue={article.authorProfileId} className="h-10 w-full rounded-md border bg-white px-2 text-sm">
              <option value="">Aucun auteur affiché</option>
              {authors.map((author) => (
                <option key={author.id} value={author.id}>{author.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Couverture</p>
            <div className="flex items-center gap-3">
              <div className="relative aspect-[16/10] w-28 shrink-0 overflow-hidden rounded-lg bg-muted">
                {coverImage && <ContentImage src={coverImage} alt="" fill sizes="112px" className="object-cover" />}
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-2 py-2 text-xs font-medium hover:bg-vert-pale">
                  {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
                  {uploading ? "Import…" : coverImage ? "Remplacer" : "Importer"}
                  <input type="file" accept={MEDIA_RULES.image.types.join(",")} onChange={uploadCover} className="sr-only" disabled={uploading} />
                </label>
                {coverImage && (
                  <button type="button" onClick={() => setCoverImage("")} className="text-xs text-red-600 hover:underline">Retirer</button>
                )}
              </div>
            </div>
            <div className="flex gap-1.5">
              <Input
                type="url"
                inputMode="url"
                value={coverUrlDraft}
                onChange={(event) => setCoverUrlDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    applyCoverUrl()
                  }
                }}
                placeholder="ou coller une URL https://…"
                aria-label="Adresse d'une image de couverture"
                className="h-8 text-xs"
              />
              <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 px-2 text-xs" onClick={applyCoverUrl} disabled={!coverUrlDraft.trim()}>
                OK
              </Button>
            </div>
            <p className="text-[0.7rem] text-muted-foreground">{MEDIA_RULES.image.label}</p>
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
