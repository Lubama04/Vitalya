"use client"

import { Children, isValidElement, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"

// ═══════════════════════════════════════════════════════════════
// Composants MDX interactifs : Accordéon, Onglets, Timeline.
// Le contenu masqué reste dans le DOM (référencement, mode livre)
// mais il est rendu inerte tant qu'il n'est pas affiché.
// ═══════════════════════════════════════════════════════════════

// ─── Accordéon / FAQ ──────────────────────────────────────────

export function Accordeon({ question, ouvert, children }: { question?: string; ouvert?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(ouvert === "true" || ouvert === "oui")
  const id = useId()
  const panelId = `${id}-reponse`
  const buttonId = `${id}-question`

  return (
    <div className={cn("accordeon my-3 overflow-hidden rounded-xl border transition-colors duration-200", open ? "border-vert-fonce/30 bg-vert-pale/30" : "bg-white hover:border-vert-fonce/20")}>
      <h3 className="m-0! font-sans text-base!">
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center gap-4 px-5 py-4 text-left font-semibold text-nuit focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-vert-emeraude"
        >
          <span className="flex-1">{question}</span>
          <span
            aria-hidden
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full transition-all duration-200",
              open ? "rotate-45 bg-orange text-white" : "bg-vert-pale text-vert-fonce",
            )}
          >
            <Plus className="size-4" />
          </span>
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        inert={!open}
        className={cn("grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 px-5 pb-5 text-[1rem] leading-relaxed text-nuit/85 [&_p]:m-0">{children}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Onglets ──────────────────────────────────────────────────

/** Un onglet : n'a de sens qu'à l'intérieur de <Onglets>. */
export function Onglet({ children }: { titre?: string; children?: ReactNode }) {
  return <>{children}</>
}

type TabChild = { titre: string; content: ReactNode }

export function Onglets({ children }: { children?: ReactNode }) {
  const tabs: TabChild[] = Children.toArray(children).flatMap((child): TabChild[] => {
    if (!isValidElement<{ titre?: string; children?: ReactNode }>(child)) return []
    const titre = child.props.titre
    return typeof titre === "string" && titre.trim() ? [{ titre: titre.trim(), content: child.props.children }] : []
  })
  const [active, setActive] = useState(0)
  const id = useId()
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([])

  if (tabs.length === 0) return null

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const last = tabs.length - 1
    const next =
      event.key === "ArrowRight" ? (active === last ? 0 : active + 1)
      : event.key === "ArrowLeft" ? (active === 0 ? last : active - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null
    if (next === null) return
    event.preventDefault()
    setActive(next)
    buttonsRef.current[next]?.focus()
  }

  return (
    <div className="onglets my-10 overflow-hidden rounded-2xl border bg-white">
      <div role="tablist" aria-label="Onglets" className="flex gap-1 overflow-x-auto border-b bg-creme/60 px-2 pt-2 [scrollbar-width:none]">
        {tabs.map((tab, index) => (
          <button
            key={`${tab.titre}-${index}`}
            ref={(element) => {
              buttonsRef.current[index] = element
            }}
            id={`${id}-onglet-${index}`}
            type="button"
            role="tab"
            aria-selected={active === index}
            aria-controls={`${id}-panneau-${index}`}
            tabIndex={active === index ? 0 : -1}
            onClick={() => setActive(index)}
            onKeyDown={onKeyDown}
            className={cn(
              "relative shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors duration-200",
              active === index
                ? "bg-white text-vert-fonce after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-orange"
                : "text-nuit/60 hover:bg-white/60 hover:text-nuit",
            )}
          >
            {tab.titre}
          </button>
        ))}
      </div>
      {tabs.map((tab, index) => (
        <div
          key={`${tab.titre}-${index}`}
          id={`${id}-panneau-${index}`}
          role="tabpanel"
          aria-labelledby={`${id}-onglet-${index}`}
          hidden={active !== index}
          tabIndex={0}
          className="space-y-4 p-5 text-[1rem] leading-relaxed sm:p-6 [&>*:first-child]:mt-0 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          {tab.content}
        </div>
      ))}
    </div>
  )
}

// ─── Timeline ─────────────────────────────────────────────────

/** Une étape de la frise (date, titre, description). */
export function Etape({ date, titre, children }: { date?: string; titre?: string; children?: ReactNode }) {
  return (
    <li className="etape group relative pb-10 pl-10 last:pb-0" data-actif="false">
      {/* Point : couleurs Vitalya alternées (vert, orange, émeraude) */}
      <span
        aria-hidden
        className="point absolute top-1 left-0 z-10 flex size-[1.15rem] items-center justify-center rounded-full border-[3px] border-white bg-vert-fonce shadow ring-2 ring-vert-fonce/20 transition-transform duration-300 group-data-[actif=true]:scale-125 group-[:nth-child(3n+2)]:bg-orange group-[:nth-child(3n+2)]:ring-orange/20 group-[:nth-child(3n)]:bg-vert-emeraude group-[:nth-child(3n)]:ring-vert-emeraude/20"
      />
      {date && (
        <p className="m-0! text-xs font-bold tracking-[0.18em] text-vert-fonce uppercase group-[:nth-child(3n+2)]:text-[#C2601B] group-[:nth-child(3n)]:text-vert-emeraude">
          {date}
        </p>
      )}
      {titre && <p className="m-0! mt-1! font-heading text-xl font-bold text-nuit">{titre}</p>}
      <div className="mt-2 text-[0.98rem] leading-relaxed text-nuit/80 [&_p]:m-0">{children}</div>
    </li>
  )
}

/** Frise chronologique : l'étape la plus proche du centre de l'écran est mise en valeur. */
export function Timeline({ titre, children }: { titre?: string; children?: ReactNode }) {
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    const list = listRef.current
    if (!list || typeof IntersectionObserver === "undefined") return
    const steps = Array.from(list.querySelectorAll<HTMLLIElement>(":scope > li.etape"))
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ;(entry.target as HTMLElement).dataset.actif = entry.isIntersecting ? "true" : "false"
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    )
    steps.forEach((step) => observer.observe(step))
    return () => observer.disconnect()
  }, [])

  return (
    <section className="timeline my-12" aria-label={titre ?? "Frise chronologique"}>
      {titre && <p className="mb-6 text-sm font-bold tracking-wider text-orange uppercase">{titre}</p>}
      <ol className="relative m-0! list-none! p-0! before:absolute before:top-2 before:bottom-2 before:left-[0.53rem] before:w-0.5 before:rounded-full before:bg-gradient-to-b before:from-vert-fonce before:via-orange before:to-vert-emeraude">
        {children}
      </ol>
    </section>
  )
}
