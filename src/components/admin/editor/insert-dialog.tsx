"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, FileVideo, ImagePlus, Loader2, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { DialogField, DialogSpec } from "./catalog"
import { MEDIA_RULES, uploadMedia, validateMedia, type MediaKind } from "./upload"

type ArticleOption = { id: string; title: string; slug: string; published: boolean }

/** Sélecteur d'articles Vitalya (liens internes). */
function ArticlePicker({ value, onChange }: { value: string; onChange: (slug: string, title: string) => void }) {
  const [articles, setArticles] = useState<ArticleOption[] | null>(null)
  const [query, setQuery] = useState("")

  useEffect(() => {
    void createClient()
      .from("articles")
      .select("id, title, slug, published")
      .order("updated_at", { ascending: false })
      .limit(300)
      .then(({ data }) => setArticles(data ?? []))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (articles ?? []).filter((article) => !q || article.title.toLowerCase().includes(q) || article.slug.includes(q)).slice(0, 50)
  }, [articles, query])

  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-2 border-b px-3">
        <Search className="size-4 text-muted-foreground" aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un article…"
          aria-label="Rechercher un article"
          className="h-10 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      <ul className="max-h-56 overflow-y-auto p-1" role="listbox" aria-label="Articles">
        {articles === null && <li className="p-3 text-sm text-muted-foreground"><Loader2 className="inline size-4 animate-spin" /> Chargement…</li>}
        {filtered.map((article) => (
          <li key={article.id} role="option" aria-selected={value === article.slug}>
            <button
              type="button"
              onClick={() => onChange(article.slug, article.title)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-vert-pale",
                value === article.slug && "bg-vert-pale font-medium text-vert-fonce",
              )}
            >
              {value === article.slug ? <Check className="size-4 shrink-0" /> : <span className="size-4 shrink-0" />}
              <span className="min-w-0 flex-1 truncate">{article.title}</span>
              {!article.published && <span className="shrink-0 text-xs text-muted-foreground">brouillon</span>}
            </button>
          </li>
        ))}
        {articles !== null && filtered.length === 0 && <li className="p-3 text-sm text-muted-foreground">Aucun article.</li>}
      </ul>
    </div>
  )
}

/** Champ de fichier : upload immédiat vers Supabase Storage, URL stockée dans la valeur. */
function MediaField({
  field,
  kind,
  multiple,
  value,
  onChange,
  onBusy,
}: {
  field: DialogField
  kind: MediaKind
  multiple: boolean
  value: string
  onChange: (value: string) => void
  onBusy: (busy: boolean) => void
}) {
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const urls: string[] = multiple ? (JSON.parse(value || "[]") as string[]) : value ? [value] : []

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    const list = Array.from(files).slice(0, multiple ? 24 - urls.length : 1)
    const invalid = list.map((file) => validateMedia(file, kind)).find(Boolean)
    if (invalid) return setError(invalid)

    setUploading(list.length)
    onBusy(true)
    try {
      const uploaded: string[] = []
      for (const file of list) {
        uploaded.push(await uploadMedia(file, kind))
        setUploading((count) => count - 1)
      }
      onChange(multiple ? JSON.stringify([...urls, ...uploaded]) : uploaded[0] ?? "")
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Import impossible.")
    } finally {
      setUploading(0)
      onBusy(false)
    }
  }

  function remove(url: string) {
    const next = urls.filter((item) => item !== url)
    onChange(multiple ? JSON.stringify(next) : "")
  }

  const Icon = kind === "video" ? FileVideo : ImagePlus

  return (
    <div className="space-y-2">
      {urls.length > 0 && (
        <div className={cn("grid gap-2", multiple ? "grid-cols-4" : "grid-cols-1")}>
          {urls.map((url) => (
            <div key={url} className="relative overflow-hidden rounded-lg border bg-muted">
              {kind === "video" ? (
                <video src={url} className="aspect-video w-full" muted preload="metadata" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className={cn("w-full object-cover", multiple ? "aspect-square" : "max-h-48")} />
              )}
              <button type="button" onClick={() => remove(url)} className="absolute top-1 right-1 rounded-full bg-white/90 p-1 text-red-600 shadow" aria-label="Retirer">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {(multiple || urls.length === 0) && (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-4 text-sm font-medium hover:bg-vert-pale">
          {uploading > 0 ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
          {uploading > 0 ? `Import en cours (${uploading})…` : multiple ? "Ajouter des images" : `Importer ${kind === "video" ? "une vidéo" : "une image"}`}
          <input
            type="file"
            accept={MEDIA_RULES[kind].types.join(",")}
            multiple={multiple}
            disabled={uploading > 0}
            onChange={(event) => {
              void handleFiles(event.target.files)
              event.target.value = ""
            }}
            className="sr-only"
            aria-label={field.label}
          />
        </label>
      )}
      <p className="text-xs text-muted-foreground">{MEDIA_RULES[kind].label}</p>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function InsertDialog({
  spec,
  content,
  selection,
  onInsert,
  onClose,
}: {
  spec: DialogSpec | null
  content: string
  selection: string
  onInsert: (mdx: string) => void
  onClose: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Valeurs initiales à chaque ouverture (la sélection pré-remplit le texte)
  useEffect(() => {
    if (!spec) return
    const initial: Record<string, string> = {}
    for (const field of spec.fields) {
      const fallback = typeof field.defaultValue === "function" ? field.defaultValue(content) : field.defaultValue
      initial[field.name] = fallback ?? (field.options?.[0]?.value ?? "")
      if (selection && ["texte", "reference", "avis"].includes(field.name)) initial[field.name] = selection
    }
    setValues(initial)
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec])

  if (!spec) return null

  const set = (name: string, value: string) => setValues((current) => ({ ...current, [name]: value }))

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!spec) return
    const missing = spec.fields.find((field) => {
      if (!field.required) return false
      const value = values[field.name] ?? ""
      return field.kind === "images" ? (JSON.parse(value || "[]") as string[]).length === 0 : !value.trim()
    })
    if (missing) return setError(`Champ requis : ${missing.label}`)
    const validation = spec.validate?.(values)
    if (validation) return setError(validation)
    onInsert(spec.build(values))
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">{spec.title}</DialogTitle>
          {spec.description && <DialogDescription>{spec.description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {spec.fields.map((field) => {
            const id = `insert-${field.name}`
            const value = values[field.name] ?? ""
            return (
              <div key={field.name} className="space-y-1.5">
                <Label htmlFor={id}>
                  {field.label}
                  {field.required && <span className="text-orange"> *</span>}
                </Label>
                {field.kind === "textarea" ? (
                  <Textarea id={id} value={value} rows={4} placeholder={field.placeholder} onChange={(event) => set(field.name, event.target.value)} />
                ) : field.kind === "select" ? (
                  <select id={id} value={value} onChange={(event) => set(field.name, event.target.value)} className="h-10 w-full rounded-md border bg-white px-3 text-sm">
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                ) : field.kind === "image" || field.kind === "images" || field.kind === "video" ? (
                  <MediaField
                    field={field}
                    kind={field.kind === "video" ? "video" : "image"}
                    multiple={field.kind === "images"}
                    value={value}
                    onChange={(next) => set(field.name, next)}
                    onBusy={setBusy}
                  />
                ) : field.kind === "article" ? (
                  <ArticlePicker
                    value={value}
                    onChange={(slug, title) => setValues((current) => ({ ...current, [field.name]: slug, articleTitle: title }))}
                  />
                ) : (
                  <Input
                    id={id}
                    type={field.kind === "number" ? "number" : field.kind === "url" ? "url" : "text"}
                    min={field.kind === "number" ? 1 : undefined}
                    value={value}
                    placeholder={field.placeholder}
                    onChange={(event) => set(field.name, event.target.value)}
                  />
                )}
                {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
              </div>
            )
          })}
          {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Annuler</Button>
            <Button type="submit" disabled={busy} className="bg-vert-fonce hover:bg-vert-fonce/90">
              {busy && <Loader2 className="size-4 animate-spin" />} {spec.submitLabel ?? "Insérer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
