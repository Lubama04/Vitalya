"use client"

import { useActionState, useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Eye, GripVertical, ImagePlus, Loader2, Plus, Save, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { deleteEdition, saveEdition } from "@/actions/magazines"
import { initialActionState } from "@/actions/types"
import { AccessBadge } from "@/components/article/access-badge"
import { uploadMedia, validateMedia } from "@/components/admin/editor/upload"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isAccessLevel } from "@/lib/constants"
import type { Edition } from "@/lib/magazine/data"
import { isAllowedImageUrl } from "@/lib/mdx/urls"
import { cn } from "@/lib/utils"

export type EditorArticle = {
  id: string
  title: string
  slug: string
  access_level: string
  published: boolean
  cover_image: string | null
  category: { name: string; color: string } | null
}

/** Édition d'un numéro : informations, couvertures, articles ordonnés (glisser-déposer), aperçu. */
export function MagazineEditor({ edition, articles, nextNumero }: { edition: Edition | null; articles: EditorArticle[]; nextNumero: number }) {
  const [state, formAction, pending] = useActionState(saveEdition, initialActionState)
  const [selected, setSelected] = useState<string[]>(edition?.articleIds ?? [])
  const [cover, setCover] = useState(edition?.couvertureUrl ?? "")
  const [pdfCover, setPdfCover] = useState(edition?.couverturePdfUrl ?? "")
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [filter, setFilter] = useState("")

  useEffect(() => {
    if (state.status === "success") toast.success(state.message)
    if (state.status === "error") toast.error(state.message)
  }, [state])

  const byId = useMemo(() => new Map(articles.map((article) => [article.id, article])), [articles])
  const available = articles.filter((article) => !selected.includes(article.id) && article.title.toLowerCase().includes(filter.toLowerCase()))

  const move = (from: number, to: number) => {
    if (to < 0 || to >= selected.length || from === to) return
    setSelected((list) => {
      const next = [...list]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  return (
    <form action={formAction} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      {edition && <input type="hidden" name="id" value={edition.id} />}
      <input type="hidden" name="articleIds" value={JSON.stringify(selected)} />
      <input type="hidden" name="couvertureUrl" value={cover} />
      <input type="hidden" name="couverturePdfUrl" value={pdfCover} />

      <div className="min-w-0 space-y-6">
        {/* ─── Informations ─── */}
        <section className="grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-[120px_minmax(0,1fr)_180px]">
          <div className="space-y-1.5">
            <Label htmlFor="mag-numero">Numéro</Label>
            <Input id="mag-numero" name="numero" type="number" min={1} max={9999} required defaultValue={edition?.numero ?? nextNumero} className="h-10" />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="mag-titre">Titre</Label>
            <Input
              id="mag-titre"
              name="titre"
              required
              maxLength={200}
              defaultValue={edition?.titre ?? `Vitalya N°${String(nextNumero).padStart(2, "0")}`}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mag-date">Date de publication</Label>
            <Input id="mag-date" name="datePublication" type="date" required defaultValue={edition?.datePublication ?? new Date().toISOString().slice(0, 10)} className="h-10" />
          </div>
        </section>

        {/* ─── Articles ─── */}
        <section className="rounded-2xl border bg-white p-5" aria-labelledby="mag-articles">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="mag-articles" className="font-sans text-lg font-semibold">
              Articles du numéro <span className="text-sm font-normal text-muted-foreground">({selected.length})</span>
            </h2>
            <p className="text-xs text-muted-foreground">Glissez-déposez pour ordonner (ou flèches).</p>
          </div>
          <ol className="space-y-2">
            {selected.map((id, index) => {
              const article = byId.get(id)
              if (!article) return null
              return (
                <li
                  key={id}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragIndex !== null) move(dragIndex, index)
                    setDragIndex(null)
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border bg-creme/40 px-3 py-2",
                    dragIndex === index && "opacity-50",
                  )}
                >
                  <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
                  <span className="w-6 shrink-0 font-heading text-lg font-bold text-vert-emeraude">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{article.title}</p>
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      {article.category && <span style={{ color: article.category.color }}>{article.category.name}</span>}
                      {!article.published && <span className="text-orange-fonce">non publié (absent du PDF des lecteurs)</span>}
                    </p>
                  </div>
                  <AccessBadge level={isAccessLevel(article.access_level) ? article.access_level : "free"} size="sm" />
                  <div className="flex shrink-0 items-center">
                    <button type="button" onClick={() => move(index, index - 1)} disabled={index === 0} className="rounded p-1 hover:bg-white disabled:opacity-30" aria-label="Monter">
                      <ArrowUp className="size-4" />
                    </button>
                    <button type="button" onClick={() => move(index, index + 1)} disabled={index === selected.length - 1} className="rounded p-1 hover:bg-white disabled:opacity-30" aria-label="Descendre">
                      <ArrowDown className="size-4" />
                    </button>
                    <button type="button" onClick={() => setSelected((list) => list.filter((item) => item !== id))} className="rounded p-1 text-red-600 hover:bg-white" aria-label="Retirer">
                      <X className="size-4" />
                    </button>
                  </div>
                </li>
              )
            })}
            {selected.length === 0 && <li className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Ajoutez des articles ci-dessous.</li>}
          </ol>

          <div className="mt-5 border-t pt-4">
            <Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Rechercher un article à ajouter…" className="mb-2 h-9" aria-label="Rechercher un article" />
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {available.map((article) => (
                <li key={article.id}>
                  <button
                    type="button"
                    onClick={() => setSelected((list) => [...list, article.id])}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-vert-pale"
                  >
                    <Plus className="size-4 shrink-0 text-vert-emeraude" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{article.title}</span>
                    {!article.published && <span className="shrink-0 text-xs text-orange-fonce">brouillon</span>}
                  </button>
                </li>
              ))}
              {available.length === 0 && <li className="px-2 py-1.5 text-sm text-muted-foreground">Aucun autre article.</li>}
            </ul>
          </div>
        </section>

        {/* ─── Aperçu de la compilation ─── */}
        <section className="rounded-2xl border bg-white p-5" aria-labelledby="mag-apercu">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="mag-apercu" className="font-sans text-lg font-semibold">Aperçu du sommaire</h2>
            {edition ? (
              <Button asChild variant="outline" size="sm">
                <a href={`/api/magazine/${edition.numero}/pdf?apercu=1`} target="_blank" rel="noopener">
                  <Eye className="size-4" /> Aperçu PDF (version enregistrée)
                </a>
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">Enregistrez le numéro pour générer l&apos;aperçu PDF.</span>
            )}
          </div>
          <ol className="divide-y text-sm">
            {selected.map((id, index) => {
              const article = byId.get(id)
              if (!article) return null
              return (
                <li key={id} className="flex items-center gap-3 py-2">
                  <span className="w-6 font-heading font-bold text-vert-emeraude">{String(index + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1 truncate">{article.title}</span>
                  {article.access_level === "expert" && <span className="shrink-0 text-xs text-muted-foreground">encart pour les abonnés Premium</span>}
                </li>
              )
            })}
          </ol>
        </section>
      </div>

      {/* ─── Couvertures et actions ─── */}
      <aside className="space-y-5">
        <CoverField
          label="Couverture"
          hint="Format portrait A4 : 800 × 1130 px conseillé."
          value={cover}
          onChange={setCover}
        />
        <label className="flex items-start gap-2 rounded-xl border bg-white p-3 text-sm">
          <input type="checkbox" name="couvertureComplete" defaultChecked={edition?.couvertureComplete ?? false} className="mt-0.5 accent-vert-emeraude" />
          <span>
            Couverture déjà composée (logo, titre et date inclus, ex. maquette Canva) : affichée seule en page 1 du PDF.
          </span>
        </label>
        <CoverField
          label="Couverture du PDF (facultatif)"
          hint="Version haute définition pour le PDF ; sinon la couverture ci-dessus est utilisée."
          value={pdfCover}
          onChange={setPdfCover}
        />

        <Button type="submit" disabled={pending} className="h-11 w-full bg-vert-fonce font-semibold text-white hover:bg-vert-fonce/90">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Enregistrer le numéro
        </Button>
        {edition && (
          <Button
            type="submit"
            formAction={deleteEdition}
            variant="outline"
            className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={(event) => {
              if (!window.confirm(`Supprimer définitivement le numéro ${edition.numero} ?`)) event.preventDefault()
            }}
          >
            <Trash2 className="size-4" /> Supprimer le numéro
          </Button>
        )}
      </aside>
    </form>
  )
}

function CoverField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (value: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const [draft, setDraft] = useState("")

  async function upload(file: File | undefined) {
    if (!file) return
    const invalid = validateMedia(file, "image")
    if (invalid) return toast.error(invalid)
    setUploading(true)
    try {
      onChange(await uploadMedia(file, "image"))
      toast.success("Couverture importée")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import impossible")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border bg-white p-4">
      <p className="text-sm font-semibold">{label}</p>
      <div className="relative mx-auto aspect-[800/1130] w-40 overflow-hidden rounded-lg bg-vert-fonce">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="size-full object-cover" />
        ) : (
          <p className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs text-white/80">Couverture par défaut (fond vert, logo, titre)</p>
        )}
      </div>
      <div className="flex gap-2">
        <label className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed px-2 py-2 text-xs font-medium hover:bg-vert-pale">
          {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />} {value ? "Remplacer" : "Importer"}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={uploading} onChange={(event) => void upload(event.target.files?.[0])} />
        </label>
        {value && (
          <button type="button" onClick={() => onChange("")} className="rounded-md px-2 text-xs text-red-600 hover:bg-red-50">
            Retirer
          </button>
        )}
      </div>
      <div className="flex gap-1.5">
        <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="ou URL https://…" className="h-8 text-xs" aria-label={`${label} : adresse`} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2 text-xs"
          disabled={!draft.trim()}
          onClick={() => {
            if (!isAllowedImageUrl(draft.trim())) return toast.error("Adresse invalide (https:// requis)")
            onChange(draft.trim())
            setDraft("")
          }}
        >
          OK
        </Button>
      </div>
      <p className="text-[0.7rem] text-muted-foreground">{hint}</p>
    </div>
  )
}
