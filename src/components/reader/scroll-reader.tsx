"use client"

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { ListTree } from "lucide-react"
import { cn } from "@/lib/utils"

type TocItem = { id: string; text: string; depth: 2 | 3 }

/** Intertitres ancrés présents dans le contenu rendu. */
function useHeadings(contentRef: RefObject<HTMLElement | null>, active: boolean): TocItem[] {
  const [items, setItems] = useState<TocItem[]>([])
  useEffect(() => {
    if (!active || !contentRef.current) return
    const headings = contentRef.current.querySelectorAll<HTMLHeadingElement>("h2[id], h3[id]")
    setItems(
      Array.from(headings).map((heading) => ({
        id: heading.id,
        text: heading.textContent?.trim() ?? "",
        depth: heading.tagName === "H3" ? 3 : 2,
      })),
    )
  }, [contentRef, active])
  return items
}

/** Section actuellement lue (intertitre le plus proche au-dessus du tiers de l'écran). */
function useActiveHeading(items: TocItem[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null)
  useEffect(() => {
    if (items.length === 0) return
    const onScroll = () => {
      const limit = window.innerHeight * 0.3
      let current: string | null = null
      for (const item of items) {
        const element = document.getElementById(item.id)
        if (element && element.getBoundingClientRect().top <= limit) current = item.id
      }
      setActiveId(current)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [items])
  return activeId
}

function TocList({ items, activeId, onNavigate }: { items: TocItem[]; activeId: string | null; onNavigate?: () => void }) {
  return (
    <ol className="space-y-1 text-sm">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            onClick={onNavigate}
            aria-current={activeId === item.id ? "location" : undefined}
            className={cn(
              "block border-l-2 py-1 leading-snug transition-colors",
              item.depth === 3 ? "pl-6 text-[0.8rem]" : "pl-3",
              activeId === item.id
                ? "border-orange font-semibold text-vert-fonce"
                : "border-transparent text-muted-foreground hover:border-vert-pale hover:text-nuit",
            )}
          >
            {item.text}
          </a>
        </li>
      ))}
    </ol>
  )
}

export function ScrollReader({
  contentRef,
  progress,
  children,
  showContent,
  placeholder,
}: {
  contentRef: RefObject<HTMLDivElement | null>
  progress: number
  children: ReactNode
  showContent: boolean
  placeholder: ReactNode
}) {
  const items = useHeadings(contentRef, showContent)
  const activeId = useActiveHeading(showContent ? items : [])
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const percent = Math.round(progress * 100)

  return (
    <>
      {/* Barre de progression fine en haut de l'écran (mobile et tablette) */}
      {showContent && (
        <div className="fixed inset-x-0 top-0 z-[55] h-1 bg-transparent lg:hidden" aria-hidden>
          <div className="h-full origin-left bg-gradient-to-r from-vert-fonce to-orange transition-transform duration-150" style={{ transform: `scaleX(${progress})` }} />
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,65ch)_220px] lg:justify-center lg:gap-14">
        <div className="min-w-0">
          {/* Sommaire repliable (mobile) */}
          {showContent && items.length > 1 && (
            <details ref={detailsRef} className="mb-8 rounded-xl border bg-creme/60 lg:hidden">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-vert-fonce">
                <ListTree className="size-4" aria-hidden /> Sommaire · {items.length} sections
              </summary>
              <nav aria-label="Sommaire de l'article" className="px-3 pb-3">
                <TocList items={items} activeId={activeId} onNavigate={() => detailsRef.current?.removeAttribute("open")} />
              </nav>
            </details>
          )}

          {showContent ? (
            <div ref={contentRef} className="prose-vitalya fondu-entree max-w-[65ch]">
              {children}
            </div>
          ) : (
            placeholder
          )}
        </div>

        {/* Colonne latérale : progression + table des matières (desktop) */}
        <aside className="hidden lg:block" aria-label="Progression et sommaire">
          <div className="sticky top-32 flex gap-4">
            <div className="relative w-1 shrink-0 self-stretch overflow-hidden rounded-full bg-vert-pale" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Progression de lecture">
              <div className="absolute inset-x-0 top-0 rounded-full bg-gradient-to-b from-vert-fonce to-orange transition-[height] duration-150" style={{ height: `${percent}%` }} />
            </div>
            <div className="min-w-0 flex-1 py-1">
              <p className="mb-3 flex items-baseline justify-between text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Sommaire <span className="font-heading text-base text-vert-fonce normal-case tabular-nums">{percent} %</span>
              </p>
              {items.length > 0 ? (
                <nav aria-label="Sommaire de l'article">
                  <TocList items={items} activeId={activeId} />
                </nav>
              ) : (
                <p className="text-xs text-muted-foreground">Article sans intertitre.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}
