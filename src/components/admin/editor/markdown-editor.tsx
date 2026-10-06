"use client"

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react"
import { Clock, Heading, Loader2, Puzzle, Type } from "lucide-react"
import { toast } from "sonner"
import { renderMdxPreview } from "@/actions/preview"
import { TooltipProvider } from "@/components/ui/tooltip"
import { computeReadingTime, countWords } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { CARET, EXTERNAL_LINK_DIALOG, IMAGE_DIALOG, INTERNAL_LINK_DIALOG, YOUTUBE_DIALOG, type CatalogItem, type DialogSpec } from "./catalog"
// Composants clients pouvant figurer dans l'aperçu rendu par le serveur :
// ils doivent faire partie du bundle de la page pour être hydratés.
import "@/components/mdx/avant-apres"
import { InsertDialog } from "./insert-dialog"
import { EditorToolbar, type QuickAction, type ViewMode } from "./toolbar"

const PREVIEW_DELAY = 500

/** Préfixe chaque ligne de la sélection (listes). */
function prefixLines(selection: string, ordered: boolean): string {
  const lines = selection ? selection.split("\n") : [`${CARET}Élément`]
  return lines.map((line, index) => `${ordered ? `${index + 1}.` : "-"} ${line.replace(/^\s*(?:[-*]|\d+\.)\s+/, "")}`).join("\n")
}

export function MarkdownEditor({
  value,
  onChange,
  categoryId,
}: {
  value: string
  onChange: (value: string) => void
  categoryId?: string
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 })
  const [dialog, setDialog] = useState<DialogSpec | null>(null)
  const [dialogSelection, setDialogSelection] = useState("")
  const [view, setView] = useState<ViewMode>("split")
  const [fullscreen, setFullscreen] = useState(false)
  const [preview, setPreview] = useState<ReactNode>(null)
  const [previewPending, startPreview] = useTransition()
  const requestRef = useRef(0)

  // ─── Aperçu temps réel (rendu serveur, même moteur que le site) ───
  useEffect(() => {
    if (view === "editeur") return
    const request = ++requestRef.current
    const timer = window.setTimeout(() => {
      startPreview(async () => {
        try {
          const node = await renderMdxPreview(value, categoryId)
          if (request === requestRef.current) setPreview(node)
        } catch {
          if (request === requestRef.current) setPreview(<p className="text-sm text-red-600">Aperçu indisponible.</p>)
        }
      })
    }, PREVIEW_DELAY)
    return () => window.clearTimeout(timer)
  }, [value, view, categoryId])

  // Échap quitte le plein écran
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !dialog && setFullscreen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [fullscreen, dialog])

  const rememberSelection = useCallback(() => {
    const area = areaRef.current
    if (area) selectionRef.current = { start: area.selectionStart, end: area.selectionEnd }
  }, [])

  const selectedText = useCallback(() => {
    const { start, end } = selectionRef.current
    return value.slice(start, end)
  }, [value])

  /** Insère du MDX à la position mémorisée, en conservant l'historique d'annulation. */
  const insert = useCallback(
    (mdx: string) => {
      const area = areaRef.current
      if (!area) return
      const { start, end } = selectionRef.current
      const caretIndex = mdx.indexOf(CARET)
      const clean = mdx.replace(CARET, "")

      area.focus()
      area.setSelectionRange(start, end)
      // execCommand conserve la pile Ctrl+Z du navigateur ; repli sur setRangeText
      const done = typeof document.execCommand === "function" && document.execCommand("insertText", false, clean)
      if (!done) {
        area.setRangeText(clean, start, end, "end")
        onChange(area.value)
      }
      const position = start + (caretIndex >= 0 ? caretIndex : clean.length)
      requestAnimationFrame(() => {
        area.focus()
        area.setSelectionRange(position, position)
        selectionRef.current = { start: position, end: position }
      })
    },
    [onChange],
  )

  const openDialog = useCallback(
    (spec: DialogSpec) => {
      rememberSelection()
      setDialogSelection(selectedText())
      setDialog(spec)
    },
    [rememberSelection, selectedText],
  )

  const handleQuick = useCallback(
    (action: QuickAction) => {
      rememberSelection()
      const selection = selectedText()
      const wrap = (marker: string, placeholder: string) =>
        insert(selection ? `${marker}${selection}${marker}` : `${marker}${CARET}${placeholder}${marker}`)

      switch (action) {
        case "bold":
          return wrap("**", "texte en gras")
        case "italic":
          return wrap("*", "texte en italique")
        case "h2":
          return insert(`\n\n## ${selection || `${CARET}Intertitre`}\n\n`)
        case "h3":
          return insert(`\n\n### ${selection || `${CARET}Sous-titre`}\n\n`)
        case "ul":
          return insert(`\n\n${prefixLines(selection, false)}\n\n`)
        case "ol":
          return insert(`\n\n${prefixLines(selection, true)}\n\n`)
        case "external-link":
          return openDialog(EXTERNAL_LINK_DIALOG)
        case "internal-link":
          return openDialog(INTERNAL_LINK_DIALOG)
        case "image":
          return IMAGE_DIALOG.kind === "dialog" ? openDialog(IMAGE_DIALOG.dialog) : undefined
        case "youtube":
          return YOUTUBE_DIALOG.kind === "dialog" ? openDialog(YOUTUBE_DIALOG.dialog) : undefined
      }
    },
    [insert, openDialog, rememberSelection, selectedText],
  )

  const handleCatalog = useCallback(
    (item: CatalogItem) => {
      // Laisse le menu se fermer avant de reprendre le focus
      window.setTimeout(() => {
        if (item.action.kind === "snippet") insert(item.action.build(selectedText()))
        else openDialog(item.action.dialog)
      }, 0)
    },
    [insert, openDialog, selectedText],
  )

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!(event.ctrlKey || event.metaKey)) return
    const key = event.key.toLowerCase()
    const map: Record<string, QuickAction> = { b: "bold", i: "italic", k: "external-link" }
    const action = map[key]
    if (action) {
      event.preventDefault()
      handleQuick(action)
    }
  }

  // ─── Statistiques synchronisées avec le calcul serveur ───
  const words = countWords(value)
  const minutes = computeReadingTime(value)
  const headings = (value.match(/^#{2,3}\s/gm) ?? []).length
  const components = (value.match(/<[A-Z][A-Za-z]*/g) ?? []).length

  return (
    <TooltipProvider delayDuration={250}>
      <div
        className={cn(
          "flex flex-col overflow-hidden border bg-white",
          fullscreen ? "fixed inset-0 z-[60] rounded-none" : "rounded-2xl",
        )}
      >
        <EditorToolbar
          onQuick={handleQuick}
          onCatalog={(item) => {
            rememberSelection()
            handleCatalog(item)
          }}
          view={view}
          onViewChange={setView}
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreen((current) => !current)}
        />

        <div
          className={cn(
            "grid",
            fullscreen ? "min-h-0 flex-1" : "h-[72vh] min-h-[420px]",
            view === "split" ? "md:grid-cols-2" : "grid-cols-1",
          )}
        >
          <div className={cn("min-h-0", view === "apercu" && "hidden")}>
            <label htmlFor="content" className="sr-only">Contenu de l&apos;article (Markdown / MDX)</label>
            <textarea
              ref={areaRef}
              id="content"
              name="content"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onSelect={rememberSelection}
              onKeyUp={rememberSelection}
              onClick={rememberSelection}
              onKeyDown={onKeyDown}
              spellCheck
              lang="fr"
              placeholder="Rédigez votre article… Utilisez « Insérer » pour ajouter des composants Vitalya."
              className="size-full resize-none bg-[#fcfcfb] p-5 font-mono text-[0.9rem] leading-relaxed text-nuit outline-none focus-visible:bg-white"
            />
          </div>
          <div
            className={cn("relative min-h-0 overflow-y-auto border-l bg-white", view === "editeur" && "hidden", view === "split" && "max-md:hidden")}
            aria-live="polite"
            aria-busy={previewPending}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/90 px-5 py-1.5 text-xs text-muted-foreground backdrop-blur">
              <span>Aperçu (rendu identique au site)</span>
              {previewPending && (
                <span className="flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> mise à jour…</span>
              )}
            </div>
            <div className="apercu-mdx prose-vitalya px-6 py-6">{preview}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t bg-muted/40 px-4 py-2 text-xs text-muted-foreground" aria-live="polite">
          <span className="flex items-center gap-1.5"><Type className="size-3.5" /> {words.toLocaleString("fr-FR")} mots</span>
          <span className="flex items-center gap-1.5"><Clock className="size-3.5" /> {minutes} min de lecture</span>
          <span className="flex items-center gap-1.5"><Heading className="size-3.5" /> {headings} intertitre(s)</span>
          <span className="flex items-center gap-1.5"><Puzzle className="size-3.5" /> {components} composant(s)</span>
          <span className="ml-auto hidden sm:inline">{value.length.toLocaleString("fr-FR")} / 200 000 caractères</span>
        </div>
      </div>

      <InsertDialog
        spec={dialog}
        content={value}
        selection={dialogSelection}
        onClose={() => {
          setDialog(null)
          requestAnimationFrame(() => areaRef.current?.focus())
        }}
        onInsert={(mdx) => {
          setDialog(null)
          // Attend la fermeture du dialogue (restitution du focus) avant d'insérer
          window.setTimeout(() => {
            insert(mdx)
            toast.success("Bloc inséré")
          }, 50)
        }}
      />
    </TooltipProvider>
  )
}
