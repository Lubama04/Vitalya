"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ExternalLink, ImagePlus, Loader2, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { saveArticle } from "@/actions/admin"
import { initialActionState } from "@/actions/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ACCESS_LABELS, ACCESS_LEVELS, computeReadingTime, slugify, type AccessLevel } from "@/lib/constants"
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

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"]
const MAX_SIZE = 5 * 1024 * 1024

/** ISO → valeur d'un champ datetime-local (heure locale du navigateur). */
function toLocalInput(iso: string | null): string {
  const date = iso ? new Date(iso) : new Date()
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

const SNIPPETS = [
  { label: "Intertitre", text: "\n\n## Intertitre\n\n" },
  { label: "Encart", text: '\n\n<Encart titre="Bon à savoir">\nVotre conseil ici.\n</Encart>\n\n' },
  { label: "Citation", text: '\n\n<Citation auteur="Nom de l\'expert">\nLa citation.\n</Citation>\n\n' },
  { label: "Liste", text: "\n\n- Premier point\n- Deuxième point\n\n" },
]

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
  const [coverImage, setCoverImage] = useState(article.coverImage)
  const [published, setPublished] = useState(article.published)
  // Calculé côté navigateur uniquement (fuseau horaire local) pour éviter un écart d'hydratation
  const [publishedAtLocal, setPublishedAtLocal] = useState("")
  const [uploading, setUploading] = useState(false)
  const contentRef = useRef<HTMLTextAreaElement>(null)

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

  function insertSnippet(text: string) {
    const area = contentRef.current
    if (!area) return
    const start = area.selectionStart
    const next = content.slice(0, start) + text + content.slice(area.selectionEnd)
    setContent(next)
    requestAnimationFrame(() => {
      area.focus()
      area.selectionStart = area.selectionEnd = start + text.length
    })
  }

  async function uploadCover(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) return toast.error("Format accepté : JPEG, PNG, WebP ou AVIF.")
    if (file.size > MAX_SIZE) return toast.error("Image trop lourde (5 Mo maximum).")

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

  const words = content.trim().split(/\s+/).filter(Boolean).length

  return (
    <form action={formAction} className="grid gap-6 xl:grid-cols-[1fr_320px]">
      {article.id && <input type="hidden" name="id" value={article.id} />}
      <input type="hidden" name="coverImage" value={coverImage} />
      <input type="hidden" name="publishedAt" value={published && publishedAtLocal ? new Date(publishedAtLocal).toISOString() : ""} />

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
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="content">Contenu (Markdown / MDX)</Label>
            <div className="flex flex-wrap gap-1">
              {SNIPPETS.map((snippet) => (
                <Button key={snippet.label} type="button" size="sm" variant="outline" onClick={() => insertSnippet(snippet.text)}>
                  + {snippet.label}
                </Button>
              ))}
            </div>
          </div>
          <Textarea
            ref={contentRef}
            id="content"
            name="content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={28}
            className="font-mono text-sm leading-relaxed"
          />
          <p className="text-xs text-muted-foreground">
            {words} mots · environ {computeReadingTime(content)} min de lecture. Composants autorisés :{" "}
            <code>&lt;Encart titre=&quot;…&quot;&gt;</code>, <code>&lt;Citation auteur=&quot;…&quot;&gt;</code>. Le
            paywall affiche les 3 premiers paragraphes aux non-abonnés.
          </p>
        </div>
      </div>

      <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
        <div className="space-y-4 rounded-2xl border bg-white p-5">
          <div className="flex items-center justify-between">
            <Label htmlFor="published">Publié</Label>
            <Switch id="published" name="published" checked={published} onCheckedChange={setPublished} />
          </div>
          {published && (
            <div className="space-y-2">
              <Label htmlFor="publishedAtLocal">Date de publication</Label>
              <Input id="publishedAtLocal" type="datetime-local" value={publishedAtLocal} onChange={(event) => setPublishedAtLocal(event.target.value)} />
              <p className="text-xs text-muted-foreground">Une date future programme la publication.</p>
            </div>
          )}
          <Button type="submit" disabled={pending || uploading} className="h-11 w-full bg-vert-fonce hover:bg-vert-fonce/90">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {published ? "Enregistrer et publier" : "Enregistrer le brouillon"}
          </Button>
          {article.id && (
            <Button asChild variant="outline" className="w-full">
              <Link href={`/articles/${article.slug}`} target="_blank">
                <ExternalLink className="size-4" /> Aperçu
              </Link>
            </Button>
          )}
        </div>

        <div className="space-y-4 rounded-2xl border bg-white p-5">
          <div className="space-y-2">
            <Label htmlFor="category">Rubrique</Label>
            <select id="category" name="category" defaultValue={article.category} className="h-10 w-full rounded-md border bg-white px-3 text-sm">
              <option value="">— Aucune —</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="accessLevel">Niveau d&apos;accès</Label>
            <select id="accessLevel" name="accessLevel" defaultValue={article.accessLevel} className="h-10 w-full rounded-md border bg-white px-3 text-sm">
              {ACCESS_LEVELS.map((level) => (
                <option key={level} value={level}>{ACCESS_LABELS[level]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border bg-white p-5">
          <p className="text-sm font-medium">Image de couverture</p>
          {coverImage ? (
            <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-muted">
              <Image src={coverImage} alt="" fill sizes="320px" className="object-cover" />
              <button type="button" onClick={() => setCoverImage("")} className="absolute top-2 right-2 rounded-full bg-white/90 p-1.5 text-red-600 shadow" aria-label="Retirer l'image">
                <Trash2 className="size-4" />
              </button>
            </div>
          ) : (
            <p className="rounded-xl bg-muted/50 p-6 text-center text-xs text-muted-foreground">Aucune image</p>
          )}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-sm font-medium hover:bg-vert-pale">
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            {uploading ? "Import en cours…" : "Importer une image"}
            <input type="file" accept={ALLOWED_TYPES.join(",")} onChange={uploadCover} className="sr-only" disabled={uploading} />
          </label>
          <p className="text-xs text-muted-foreground">JPEG, PNG, WebP ou AVIF · 5 Mo max · format paysage conseillé.</p>
        </div>

        {canDelete && article.id && deleteAction && (
          <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5">
            <p className="mb-3 text-sm text-red-800">Supprimer définitivement cet article et ses commentaires.</p>
            <Button
              type="submit"
              formAction={deleteAction}
              formNoValidate
              variant="destructive"
              className="w-full"
              onClick={(event) => {
                if (!window.confirm("Supprimer définitivement cet article ?")) event.preventDefault()
              }}
            >
              <Trash2 className="size-4" /> Supprimer
            </Button>
          </div>
        )}
      </aside>
    </form>
  )
}
