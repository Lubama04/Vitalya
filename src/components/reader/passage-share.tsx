"use client"

import { useCallback, useEffect, useState, type RefObject } from "react"
import { Link2, MessageCircle } from "lucide-react"
import { toast } from "sonner"

// ═══════════════════════════════════════════════════════════════
// Partage d'un passage
// - sélection de texte dans l'article → infobulle WhatsApp / Facebook /
//   Copier le lien, avec une URL ?highlight=<passage> ;
// - à l'ouverture d'une telle URL, le passage est surligné (API CSS
//   Custom Highlight : aucune modification du DOM rendu par React).
// Le paramètre n'est jamais injecté dans la page : il sert uniquement
// de texte à rechercher.
// ═══════════════════════════════════════════════════════════════

const MIN_LENGTH = 3
const MAX_LENGTH = 280
const HIGHLIGHT_NAME = "vitalya-passage"

type Bubble = { text: string; x: number; y: number; below: boolean }

/** Nœuds texte du conteneur et texte normalisé (espaces fusionnés), avec correspondance des positions. */
function indexText(container: HTMLElement) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const map: { node: Text; offset: number }[] = []
  let text = ""
  let lastSpace = true
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const value = node.data
    for (let index = 0; index < value.length; index += 1) {
      const isSpace = /\s/.test(value[index] ?? "")
      if (isSpace && lastSpace) continue
      text += isSpace ? " " : value[index]
      map.push({ node, offset: index })
      lastSpace = isSpace
    }
  }
  return { text, map }
}

/** Range couvrant la première occurrence du passage (insensible à la casse). */
function findPassage(container: HTMLElement, passage: string): Range | null {
  const needle = passage.replace(/\s+/g, " ").trim().toLowerCase()
  if (needle.length < MIN_LENGTH) return null
  const { text, map } = indexText(container)
  const start = text.toLowerCase().indexOf(needle)
  if (start < 0) return null
  const first = map[start]
  const last = map[start + needle.length - 1]
  if (!first || !last) return null
  const range = document.createRange()
  range.setStart(first.node, first.offset)
  range.setEnd(last.node, last.offset + 1)
  return range
}

function shareUrl(passage: string): string {
  const url = new URL(window.location.href)
  url.search = ""
  url.hash = ""
  url.searchParams.set("highlight", passage)
  return url.toString()
}

export function PassageShare({ containerRef, active }: { containerRef: RefObject<HTMLElement | null>; active: boolean }) {
  const [bubble, setBubble] = useState<Bubble | null>(null)

  // ─── Surlignage d'un passage reçu par lien ───
  useEffect(() => {
    if (!active) return
    const passage = new URLSearchParams(window.location.search).get("highlight")?.slice(0, MAX_LENGTH)
    if (!passage) return
    const timer = window.setTimeout(() => {
      const container = containerRef.current
      if (!container) return
      const range = findPassage(container, passage)
      if (!range) {
        toast.info("Le passage partagé n'a pas été retrouvé dans l'article.")
        return
      }
      if ("highlights" in CSS && typeof Highlight !== "undefined") {
        CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(range))
      } else {
        // Repli : sélection native du passage
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
      const rect = range.getBoundingClientRect()
      window.scrollTo({ top: window.scrollY + rect.top - window.innerHeight / 3, behavior: "instant" })
    }, 400)
    return () => {
      window.clearTimeout(timer)
      if ("highlights" in CSS) CSS.highlights.delete(HIGHLIGHT_NAME)
    }
  }, [active, containerRef])

  // ─── Infobulle sur sélection ───
  const update = useCallback(() => {
    const container = containerRef.current
    const selection = window.getSelection()
    if (!active || !container || !selection || selection.isCollapsed || selection.rangeCount === 0) {
      setBubble(null)
      return
    }
    const range = selection.getRangeAt(0)
    if (!container.contains(range.commonAncestorContainer)) {
      setBubble(null)
      return
    }
    const text = selection.toString().replace(/\s+/g, " ").trim()
    if (text.length < MIN_LENGTH) {
      setBubble(null)
      return
    }
    const rect = range.getBoundingClientRect()
    // Sur écran tactile, le menu natif occupe le dessus : on se place en dessous
    const touch = window.matchMedia("(pointer: coarse)").matches
    const below = touch || rect.top < 90
    setBubble({
      text: text.slice(0, MAX_LENGTH),
      x: Math.min(window.innerWidth - 110, Math.max(110, rect.left + rect.width / 2)),
      y: below ? rect.bottom + 10 : rect.top - 10,
      below,
    })
  }, [active, containerRef])

  useEffect(() => {
    if (!active) return
    let timer: number | undefined
    const onSelection = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(update, 120)
    }
    const hide = () => setBubble(null)
    document.addEventListener("selectionchange", onSelection)
    window.addEventListener("scroll", hide, { passive: true })
    window.addEventListener("resize", hide)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener("selectionchange", onSelection)
      window.removeEventListener("scroll", hide)
      window.removeEventListener("resize", hide)
    }
  }, [active, update])

  if (!bubble) return null

  const url = shareUrl(bubble.text)
  const message = `« ${bubble.text} » ${url}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Lien vers le passage copié")
    } catch {
      toast.error("Copie impossible")
    }
    setBubble(null)
  }

  return (
    <div
      role="toolbar"
      aria-label="Partager ce passage"
      className="fixed z-[60] flex items-center gap-1 rounded-full bg-nuit p-1 shadow-xl motion-safe:animate-in motion-safe:fade-in"
      style={{ left: bubble.x, top: bubble.y, transform: `translate(-50%, ${bubble.below ? "0" : "-100%"})` }}
      // Empêche la perte de la sélection au clic
      onMouseDown={(event) => event.preventDefault()}
    >
      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Partager sur WhatsApp"
        title="WhatsApp"
        className="flex size-9 items-center justify-center rounded-full bg-[#25D366] text-white hover:brightness-110"
        onClick={() => setBubble(null)}
      >
        <MessageCircle className="size-4" />
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Partager sur Facebook"
        title="Facebook"
        className="flex size-9 items-center justify-center rounded-full bg-[#1877F2] font-sans text-lg font-bold text-white hover:brightness-110"
        onClick={() => setBubble(null)}
      >
        f
      </a>
      <button
        type="button"
        onClick={copy}
        aria-label="Copier le lien du passage"
        title="Copier le lien"
        className="flex size-9 items-center justify-center rounded-full text-white hover:bg-white/15"
      >
        <Link2 className="size-4" />
      </button>
    </div>
  )
}
