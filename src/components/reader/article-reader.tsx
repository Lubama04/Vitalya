"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import dynamic from "next/dynamic"
import { BookOpen, History, ScrollText, X } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { ReadingMode } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { BookMeta } from "./book-reader"
import { createPositionSaver, loadPosition, persistMode, readLocalMode } from "./persistence"
import { ScrollReader } from "./scroll-reader"

// Chargés à la demande : le mode livre n'est téléchargé qu'à son ouverture
const BookReader = dynamic(() => import("./book-reader").then((mod) => mod.BookReader), { ssr: false })
const PassageShare = dynamic(() => import("./passage-share").then((mod) => mod.PassageShare), { ssr: false })

// Position minimale / maximale pour proposer une reprise
const RESUME_MIN = 0.04
const RESUME_MAX = 0.96

function ModeSwitcher({ mode, onChange, tone = "light" }: { mode: ReadingMode; onChange: (mode: ReadingMode) => void; tone?: "light" | "paper" }) {
  const options: { value: ReadingMode; label: string; icon: typeof BookOpen }[] = [
    { value: "scroll", label: "Mode défilement", icon: ScrollText },
    { value: "book", label: "Mode livre", icon: BookOpen },
  ]
  return (
    <div role="radiogroup" aria-label="Mode de lecture" className={cn("inline-flex rounded-full border p-0.5", tone === "paper" ? "border-vert-fonce/15 bg-white/70" : "bg-white shadow-sm")}>
      {options.map(({ value, label, icon: Icon }) => (
        <Tooltip key={value}>
          <TooltipTrigger asChild>
            <button
              type="button"
              role="radio"
              aria-checked={mode === value}
              aria-label={label}
              onClick={() => onChange(value)}
              className={cn(
                "flex h-8 w-10 items-center justify-center rounded-full transition-colors duration-200",
                mode === value ? "bg-vert-fonce text-white shadow-sm" : "text-nuit/60 hover:text-vert-fonce",
              )}
            >
              <Icon className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

export function ArticleReader({
  articleId,
  meta,
  initialMode,
  userId,
  children,
  endSlot,
  footer,
}: {
  articleId: string
  meta: BookMeta
  /** Mode enregistré dans le profil (null si visiteur non connecté) */
  initialMode: ReadingMode | null
  userId: string | null
  children: ReactNode
  endSlot?: ReactNode
  footer?: ReactNode
}) {
  const [mode, setMode] = useState<ReadingMode>(initialMode ?? "scroll")
  const [progress, setProgress] = useState(0)
  const [bookStart, setBookStart] = useState<{ progress: number; page: number | null } | null>(null)
  const [scrollResume, setScrollResume] = useState<number | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const trackingRef = useRef(false)
  const progressRef = useRef(0)
  const saver = useMemo(() => createPositionSaver(articleId, userId), [articleId, userId])

  // ─── Au chargement : mode préféré + dernière position ───
  useEffect(() => {
    let cancelled = false
    // Lien vers un passage (?highlight=) : ouverture en mode défilement pour le surligner
    const sharedPassage = new URLSearchParams(window.location.search).has("highlight")
    const effectiveMode = sharedPassage ? "scroll" : (initialMode ?? readLocalMode() ?? "scroll")
    if (effectiveMode !== mode) setMode(effectiveMode)

    void loadPosition(articleId, userId).then((saved) => {
      if (cancelled) return
      const resumable = saved && saved.progress > RESUME_MIN && saved.progress < RESUME_MAX
      if (effectiveMode === "book") {
        // Mode livre : reprise automatique à la page enregistrée
        setBookStart({
          progress: resumable ? saved.progress : 0,
          page: resumable && saved.mode === "book" ? saved.page : null,
        })
      } else if (resumable) {
        // Mode défilement : proposition discrète de reprise
        setScrollResume(saved.progress)
      }
    })
    return () => {
      cancelled = true
    }
    // Uniquement au montage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId, userId])

  // ─── Suivi de la progression en mode défilement ───
  const computeScrollProgress = useCallback(() => {
    const content = contentRef.current
    if (!content) return 0
    const rect = content.getBoundingClientRect()
    const read = window.innerHeight * 0.4 - rect.top
    return Math.min(1, Math.max(0, read / Math.max(1, rect.height)))
  }, [])

  useEffect(() => {
    if (mode !== "scroll") return
    const onScroll = () => {
      const value = computeScrollProgress()
      progressRef.current = value
      setProgress(value)
      // On n'enregistre qu'après une vraie lecture (pas au chargement)
      if (trackingRef.current) saver.save({ progress: value, page: null, mode: "scroll" })
    }
    const onUserScroll = () => {
      trackingRef.current = true
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("wheel", onUserScroll, { passive: true })
    window.addEventListener("touchmove", onUserScroll, { passive: true })
    window.addEventListener("keydown", onUserScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("wheel", onUserScroll)
      window.removeEventListener("touchmove", onUserScroll)
      window.removeEventListener("keydown", onUserScroll)
    }
  }, [mode, computeScrollProgress, saver])

  // La proposition de reprise disparaît si le lecteur avance ou après 15 s
  useEffect(() => {
    if (scrollResume === null) return
    if (progress >= scrollResume - 0.02) setScrollResume(null)
  }, [progress, scrollResume])
  useEffect(() => {
    if (scrollResume === null) return
    const timer = window.setTimeout(() => setScrollResume(null), 15000)
    return () => window.clearTimeout(timer)
  }, [scrollResume])

  // Envoi de la position au compte en quittant la page
  useEffect(() => {
    const flush = () => saver.flush()
    const onVisibility = () => document.visibilityState === "hidden" && flush()
    window.addEventListener("pagehide", flush)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      flush()
      window.removeEventListener("pagehide", flush)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [saver])

  // Mode livre : page figée en arrière-plan
  useEffect(() => {
    if (mode !== "book") return
    const previous = document.documentElement.style.overflow
    document.documentElement.style.overflow = "hidden"
    return () => {
      document.documentElement.style.overflow = previous
    }
  }, [mode])

  /** Fait défiler jusqu'à une position (0 → 1) du contenu. */
  const scrollToProgress = useCallback((value: number, behavior: ScrollBehavior = "smooth") => {
    const content = contentRef.current
    if (!content) return
    const top = content.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: Math.max(0, top + value * content.offsetHeight - window.innerHeight * 0.4), behavior })
  }, [])

  const changeMode = useCallback(
    (next: ReadingMode) => {
      if (next === mode) return
      void persistMode(next, Boolean(userId))
      setScrollResume(null)
      if (next === "book") {
        // On ouvre le livre à l'endroit où l'on en était
        setBookStart({ progress: progressRef.current, page: null })
        setMode("book")
      } else {
        const resumeAt = progressRef.current
        setMode("scroll")
        // Après le retour du contenu dans la page, on rejoint la même position (saut direct)
        window.setTimeout(() => {
          trackingRef.current = true
          scrollToProgress(resumeAt, "instant")
        }, 50)
      }
    },
    [mode, userId, scrollToProgress],
  )

  const onBookProgress = useCallback(
    (value: number, page: number) => {
      progressRef.current = value
      saver.save({ progress: value, page, mode: "book" })
    },
    [saver],
  )

  const switcher = <ModeSwitcher mode={mode} onChange={changeMode} />

  return (
    <TooltipProvider delayDuration={200}>
      <div ref={anchorRef}>
        {/* Sélecteur de mode, en haut de chaque article */}
        <div className="mb-8 flex items-center justify-between gap-4 lg:mx-auto lg:max-w-[calc(65ch+220px+3.5rem)]">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Mode de lecture</p>
          {switcher}
        </div>

        <ScrollReader
          contentRef={contentRef}
          progress={progress}
          showContent={mode === "scroll"}
          placeholder={
            <button
              type="button"
              onClick={() => setMode("book")}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-vert-fonce/30 bg-vert-pale/40 py-16 font-medium text-vert-fonce"
            >
              <BookOpen className="size-5" /> Rouvrir le livre
            </button>
          }
        >
          {children}
          {endSlot && <div className="mt-8">{endSlot}</div>}
        </ScrollReader>

        {footer && <div className="lg:mx-auto lg:max-w-[calc(65ch+220px+3.5rem)] lg:pr-[calc(220px+3.5rem)]">{footer}</div>}
      </div>

      <PassageShare containerRef={contentRef} active={mode === "scroll"} />

      {/* Proposition de reprise (mode défilement) */}
      {mode === "scroll" && scrollResume !== null && (
        <div role="status" className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 motion-safe:animate-in motion-safe:slide-in-from-bottom-2 motion-safe:fade-in">
          <div className="flex items-center gap-2 rounded-full bg-nuit/95 py-1.5 pr-1.5 pl-4 text-sm text-white shadow-xl">
            <History className="size-4 text-or" aria-hidden />
            <span className="hidden sm:inline">Vous en étiez à {Math.round(scrollResume * 100)} %</span>
            <button
              type="button"
              onClick={() => {
                trackingRef.current = true
                scrollToProgress(scrollResume)
                setScrollResume(null)
              }}
              className="rounded-full bg-orange px-3 py-1 text-xs font-semibold text-nuit hover:bg-orange/90"
            >
              Reprendre depuis ici
            </button>
            <button type="button" onClick={() => setScrollResume(null)} aria-label="Ignorer" className="rounded-full p-1 text-white/70 hover:text-white">
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {mode === "book" && bookStart && (
        <BookReader
          meta={meta}
          endSlot={endSlot}
          initialProgress={bookStart.progress}
          resumePage={bookStart.page}
          onProgress={onBookProgress}
          onClose={() => changeMode("scroll")}
          modeSwitcher={<ModeSwitcher mode={mode} onChange={changeMode} tone="paper" />}
        >
          {children}
        </BookReader>
      )}
    </TooltipProvider>
  )
}
