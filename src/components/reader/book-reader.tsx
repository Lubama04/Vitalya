"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { ChevronLeft, ChevronRight, Clock, Maximize2, Minimize2, RotateCcw, X } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

// ═══════════════════════════════════════════════════════════════
// Mode livre
// Pagination : le contenu est mis en colonnes CSS de la taille d'une
// page ; chaque colonne est une page. Les vrais nœuds React restent
// en place (composants interactifs fonctionnels) et les règles
// break-inside: avoid empêchent de couper un paragraphe ou un bloc.
// Animation : une « feuille » (copie visuelle de la page) pivote en
// 3D autour de la reliure pendant que la page suivante est déjà dessous.
// ═══════════════════════════════════════════════════════════════

const FLIP_MS = 300
const SWIPE_MIN = 50

export type BookMeta = {
  title: string
  subtitle: string | null
  category: string | null
  categoryColor: string | null
  readingTime: number
  coverImage: string | null
}

type Flip = { dir: "next" | "prev" }

export function BookReader({
  meta,
  children,
  endSlot,
  initialProgress,
  resumePage,
  onProgress,
  onClose,
  modeSwitcher,
}: {
  meta: BookMeta
  children: ReactNode
  endSlot?: ReactNode
  initialProgress: number
  resumePage: number | null
  onProgress: (progress: number, page: number) => void
  onClose: () => void
  modeSwitcher: ReactNode
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const leafRef = useRef<HTMLDivElement>(null)

  const [box, setBox] = useState({ width: 0, height: 0, padX: 24, padY: 28 })
  const [pageCount, setPageCount] = useState(1)
  const [page, setPage] = useState(0)
  const [underPage, setUnderPage] = useState(0)
  const [flip, setFlip] = useState<Flip | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [resumeNotice, setResumeNotice] = useState<number | null>(null)
  const progressRef = useRef(initialProgress)
  const restoredRef = useRef(false)
  const touchRef = useRef<{ x: number; y: number } | null>(null)

  const innerWidth = Math.max(0, box.width - box.padX * 2)
  const innerHeight = Math.max(0, box.height - box.padY * 2)
  const gap = box.padX * 2
  const step = innerWidth + gap

  // ─── Dimensions de la page ───
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const measure = () => {
      const width = viewport.clientWidth
      const height = viewport.clientHeight
      const padX = width < 480 ? 20 : 44
      const padY = width < 480 ? 24 : 40
      setBox((current) =>
        current.width === width && current.height === height ? current : { width, height, padX, padY },
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  // ─── Nombre de pages (recalculé : taille, polices, images) ───
  const countPages = useCallback(() => {
    const strip = stripRef.current
    // Attendre une mesure réelle du conteneur (sinon le nombre de pages est faux)
    if (!strip || innerWidth < 120 || innerHeight < 120) return
    const count = Math.max(1, Math.ceil((strip.scrollWidth + gap) / step - 0.02))
    setPageCount(count)
    // Conserver la position de lecture lors d'un changement de mise en page
    const target = Math.min(count - 1, Math.round(progressRef.current * (count - 1)))
    if (!restoredRef.current) {
      restoredRef.current = true
      const start = resumePage !== null && resumePage < count ? resumePage : target
      setPage(start)
      setUnderPage(start)
      if (start > 0) setResumeNotice(start)
      return
    }
    setPage((current) => (current > count - 1 ? count - 1 : current))
    setUnderPage((current) => (current > count - 1 ? count - 1 : current))
  }, [gap, step, resumePage, innerWidth, innerHeight])

  useLayoutEffect(() => {
    countPages()
  }, [countPages, innerWidth, innerHeight])

  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    const onLoad = () => countPages()
    strip.addEventListener("load", onLoad, true) // images chargées plus tard
    void document.fonts?.ready.then(() => countPages())
    return () => strip.removeEventListener("load", onLoad, true)
  }, [countPages])

  // ─── Progression ───
  useEffect(() => {
    // Rien n'est calculé ni enregistré avant la restauration de la position
    if (!restoredRef.current) return
    const progress = pageCount > 1 ? page / (pageCount - 1) : 0
    progressRef.current = progress
    onProgress(progress, page)
  }, [page, pageCount, onProgress])

  useEffect(() => {
    if (resumeNotice === null) return
    const timer = window.setTimeout(() => setResumeNotice(null), 6000)
    return () => window.clearTimeout(timer)
  }, [resumeNotice])

  // ─── Tourner la page ───
  const goTo = useCallback(
    (target: number) => {
      if (flip || target < 0 || target > pageCount - 1 || target === page) return
      const dir: Flip["dir"] = target > page ? "next" : "prev"
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      const leaf = leafRef.current
      const strip = stripRef.current
      setResumeNotice(null)

      if (reduced || !leaf || !strip || Math.abs(target - page) > 1) {
        setPage(target)
        setUnderPage(target)
        return
      }

      // Copie visuelle de la page qui tourne (sans médias actifs ni identifiants en double)
      const clone = strip.cloneNode(true) as HTMLElement
      clone.querySelectorAll("iframe, video").forEach((media) => {
        const placeholder = document.createElement("div")
        placeholder.className = "aspect-video w-full rounded-2xl bg-nuit/80"
        media.replaceWith(placeholder)
      })
      clone.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"))
      clone.removeAttribute("id")
      clone.style.transform = `translateX(${-(dir === "next" ? page : target) * step}px)`
      clone.setAttribute("aria-hidden", "true")
      leaf.querySelector("[data-leaf-content]")?.replaceChildren(clone)

      // Page suivante : déjà dessous. Page précédente : la feuille vient la recouvrir.
      if (dir === "next") setUnderPage(target)
      setPage(target)
      setFlip({ dir })
      window.setTimeout(() => {
        setUnderPage(target)
        setFlip(null)
        leaf.querySelector("[data-leaf-content]")?.replaceChildren()
      }, FLIP_MS)
    },
    [flip, page, pageCount, step],
  )

  const next = useCallback(() => goTo(page + 1), [goTo, page])
  const prev = useCallback(() => goTo(page - 1), [goTo, page])

  // ─── Clavier ───
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable=true]")) return
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault()
        next()
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault()
        prev()
      } else if (event.key === "Home") {
        goTo(0)
      } else if (event.key === "End") {
        goTo(pageCount - 1)
      } else if (event.key === "Escape" && !document.fullscreenElement) {
        onClose()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [next, prev, goTo, pageCount, onClose])

  // ─── Plein écran ───
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await rootRef.current?.requestFullscreen()
    } catch {
      // Plein écran refusé ou indisponible
    }
  }

  // ─── Swipe tactile (le défilement vertical natif reste prioritaire) ───
  function onPointerDown(event: React.PointerEvent) {
    if (event.pointerType === "mouse") return
    touchRef.current = { x: event.clientX, y: event.clientY }
  }
  function onPointerUp(event: React.PointerEvent) {
    const start = touchRef.current
    touchRef.current = null
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return
    if (dx < 0) next()
    else prev()
  }

  // Ancres internes (#source-1, sommaire…) : aller à la page qui les contient
  function onClickCapture(event: React.MouseEvent) {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]')
    const strip = stripRef.current
    if (!link || !strip) return
    const id = decodeURIComponent(link.getAttribute("href")?.slice(1) ?? "")
    const target = id ? strip.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`) : null
    if (!target) return
    event.preventDefault()
    const stripLeft = strip.getBoundingClientRect().left
    const offset = target.getBoundingClientRect().left - stripLeft
    goTo(Math.max(0, Math.min(pageCount - 1, Math.floor((offset + 1) / step))))
  }

  const canFullscreen = typeof document !== "undefined" && document.fullscreenEnabled

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Lecture en mode livre : ${meta.title}`}
      className="fixed inset-0 z-[70] flex flex-col bg-[#f3efe6] motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-[0.98] motion-safe:duration-300"
    >
      {/* ─── Barre supérieure ─── */}
      <header className="flex items-center gap-2 px-3 py-2 sm:px-5">
        <p className="min-w-0 flex-1 truncate font-heading text-sm font-semibold text-vert-fonce sm:text-base">{meta.title}</p>
        {modeSwitcher}
        {canFullscreen && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" onClick={toggleFullscreen} className="rounded-full p-2 text-nuit/70 hover:bg-white hover:text-nuit" aria-label={fullscreen ? "Quitter le plein écran" : "Plein écran"}>
                {fullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{fullscreen ? "Quitter le plein écran" : "Plein écran"}</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-nuit/70 hover:bg-white hover:text-nuit" aria-label="Fermer le mode livre">
              <X className="size-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Fermer (Échap)</TooltipContent>
        </Tooltip>
      </header>

      {/* ─── Livre ─── */}
      <div className="relative flex min-h-0 flex-1 items-stretch justify-center px-2 pb-1 sm:px-14">
        <button
          type="button"
          onClick={prev}
          disabled={page === 0}
          aria-label="Page précédente"
          className="absolute top-1/2 left-1 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-vert-fonce shadow-md transition-opacity hover:bg-white disabled:pointer-events-none disabled:opacity-0 sm:left-3 sm:size-12"
        >
          <ChevronLeft className="size-6" />
        </button>

        <div className="relative w-full max-w-[720px] [perspective:1200px]">
          {/* Page affichée */}
          <div
            ref={viewportRef}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onClickCapture={onClickCapture}
            className="relative h-full touch-pan-y overflow-hidden rounded-r-xl rounded-l-sm bg-white shadow-[0_10px_40px_rgba(30,37,50,0.18)]"
            style={{ padding: `${box.padY}px ${box.padX}px` }}
          >
            {/* Ombre de reliure */}
            <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-black/[0.07] to-transparent" />
            <div
              ref={stripRef}
              className="livre-pages apercu-mdx prose-vitalya will-change-transform"
              style={{
                width: innerWidth,
                height: innerHeight,
                columnWidth: innerWidth,
                columnGap: gap,
                columnFill: "auto",
                transform: `translateX(${-underPage * step}px)`,
              }}
            >
              {/* Page de titre */}
              <section className="livre-titre flex h-full flex-col justify-end">
                {meta.coverImage && (
                  <div className="relative mb-6 min-h-0 flex-1 overflow-hidden rounded-xl bg-vert-pale">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={meta.coverImage} alt="" className="absolute inset-0 size-full max-h-none! object-cover" />
                  </div>
                )}
                {meta.category && (
                  <p className="mb-3 text-xs font-bold tracking-[0.2em] uppercase" style={{ color: meta.categoryColor ?? "#0D6B4A" }}>
                    {meta.category}
                  </p>
                )}
                <h1 className="!m-0 font-heading text-4xl leading-tight font-bold text-vert-fonce sm:text-5xl">{meta.title}</h1>
                {meta.subtitle && <p className="mt-4 font-heading text-lg leading-relaxed text-nuit/75 italic">{meta.subtitle}</p>}
                <p className="mt-6 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="size-4" aria-hidden /> {meta.readingTime} min de lecture · Vitalya
                </p>
                <div className="mt-8 h-1 w-16 rounded-full bg-orange" />
              </section>
              {children}
              {endSlot && <div className="livre-fin">{endSlot}</div>}
            </div>
          </div>

          {/* Feuille qui tourne (copie visuelle, 300 ms) */}
          <div
            ref={leafRef}
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 z-30 origin-left [transform-style:preserve-3d]",
              flip ? (flip.dir === "next" ? "livre-flip-next" : "livre-flip-prev") : "invisible",
            )}
          >
            <div
              className="absolute inset-0 overflow-hidden rounded-r-xl rounded-l-sm bg-white [backface-visibility:hidden]"
              style={{ padding: `${box.padY}px ${box.padX}px` }}
            >
              <div data-leaf-content className="livre-pages apercu-mdx prose-vitalya" style={{ width: innerWidth, height: innerHeight, overflow: "visible" }} />
              <div className="livre-ombre absolute inset-0" />
            </div>
            {/* Verso de la feuille */}
            <div className="absolute inset-0 rounded-l-xl rounded-r-sm bg-gradient-to-l from-[#ece6d8] to-[#f8f5ee] shadow-inner [backface-visibility:hidden] [transform:rotateY(180deg)]" />
          </div>
        </div>

        <button
          type="button"
          onClick={next}
          disabled={page >= pageCount - 1}
          aria-label="Page suivante"
          className="absolute top-1/2 right-1 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-vert-fonce text-white shadow-md transition-opacity hover:bg-vert-fonce/90 disabled:pointer-events-none disabled:opacity-0 sm:right-3 sm:size-12"
        >
          <ChevronRight className="size-6" />
        </button>

        {resumeNotice !== null && (
          <div role="status" className="absolute top-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full bg-nuit/90 py-1.5 pr-1.5 pl-4 text-sm text-white shadow-lg motion-safe:animate-in motion-safe:fade-in">
            Reprise de la lecture page {resumeNotice + 1}
            <button type="button" onClick={() => goTo(0)} className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs hover:bg-white/25">
              <RotateCcw className="size-3" /> Début
            </button>
          </div>
        )}
      </div>

      {/* ─── Pied : numéro de page + progression ─── */}
      <footer className="px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="mx-auto flex max-w-[720px] items-center gap-4">
          <p className="shrink-0 text-sm font-semibold text-vert-fonce tabular-nums" aria-live="polite">
            Page {page + 1} / {pageCount}
          </p>
          <div
            className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-vert-fonce/15"
            role="progressbar"
            aria-label="Progression dans l'article"
            aria-valuemin={1}
            aria-valuemax={pageCount}
            aria-valuenow={page + 1}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-vert-fonce transition-[width] duration-300 ease-out"
              style={{ width: `${pageCount > 1 ? ((page + 1) / pageCount) * 100 : 100}%` }}
            />
            <div
              className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-orange shadow transition-[left] duration-300 ease-out"
              style={{ left: `${pageCount > 1 ? ((page + 1) / pageCount) * 100 : 100}%` }}
            />
          </div>
        </div>
      </footer>
    </div>
  )
}
