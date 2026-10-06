import type { ReactNode } from "react"
import Link from "next/link"
import {
  ArrowRight,
  BookOpenCheck,
  CircleAlert,
  CircleCheck,
  CircleX,
  Info,
  Leaf,
  Lightbulb,
  ListTree,
  OctagonAlert,
  Quote,
  ShieldAlert,
  Siren,
  TriangleAlert,
} from "lucide-react"
import { isAllowedMediaUrl, isExternalHref, isSafeHref } from "@/lib/mdx/urls"
import { cn } from "@/lib/utils"

// Composants éditoriaux autorisés dans les articles.
// Toutes les props arrivent sous forme de chaînes (voir le plugin de liste
// blanche) : chaque composant valide et normalise ses propres valeurs.

type WithChildren = { children?: ReactNode }

// ─── Texte ────────────────────────────────────────────────────

/** Chapeau : résumé introductif de 2 à 4 phrases. */
export function Chapeau({ children }: WithChildren) {
  return (
    <div className="chapeau mb-10 border-l-4 border-vert-emeraude pl-6 font-heading text-[1.35rem] leading-relaxed text-nuit/85 italic [&_p]:m-0">
      {children}
    </div>
  )
}

/** Paragraphe ouvert par une lettrine. */
export function Lettrine({ children }: WithChildren) {
  return <div className="lettrine [&>p]:m-0">{children}</div>
}

export function Citation({ auteur, fonction, children }: WithChildren & { auteur?: string; fonction?: string }) {
  return (
    <figure className="my-12 rounded-2xl bg-creme px-8 py-8 sm:px-10">
      <Quote className="mb-3 size-8 text-orange" aria-hidden />
      <blockquote className="m-0 border-0 p-0 font-heading text-2xl leading-snug text-vert-fonce italic sm:text-[1.7rem] [&_p]:m-0">
        {children}
      </blockquote>
      {auteur && (
        <figcaption className="mt-5 text-sm">
          <span className="font-semibold text-nuit">— {auteur}</span>
          {fonction && <span className="text-muted-foreground">, {fonction}</span>}
        </figcaption>
      )}
    </figure>
  )
}

// ─── Information ──────────────────────────────────────────────

/** Encart conseil (historique : utilisé dans les premiers articles). */
export function Encart({ titre, children }: WithChildren & { titre?: string }) {
  return (
    <aside className="my-10 rounded-2xl border border-vert-emeraude/25 bg-vert-pale/60 p-6 sm:p-7">
      <p className="mb-3 flex items-center gap-2 font-heading text-lg font-bold text-vert-fonce">
        <span className="flex size-8 items-center justify-center rounded-full bg-white text-orange shadow-sm">
          <Lightbulb className="size-4" aria-hidden />
        </span>
        {titre ?? "Bon à savoir"}
      </p>
      <div className="space-y-3 text-[1rem] leading-relaxed text-nuit/85 [&_strong]:text-vert-fonce">{children}</div>
    </aside>
  )
}

export function ARetenir({ titre, children }: WithChildren & { titre?: string }) {
  return (
    <aside className="my-10 overflow-hidden rounded-2xl border-2 border-vert-fonce">
      <p className="flex items-center gap-2 bg-vert-fonce px-6 py-3 font-sans text-sm font-bold tracking-wider text-white uppercase">
        <BookOpenCheck className="size-4 text-or" aria-hidden /> {titre ?? "À retenir"}
      </p>
      <div className="px-6 py-5 text-[1rem] [&_li]:relative [&_li]:pl-7 [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:font-bold [&_li]:before:text-vert-emeraude [&_li]:before:content-['✓'] [&_ul]:list-none [&_ul]:space-y-2.5 [&_ul]:pl-0">
        {children}
      </div>
    </aside>
  )
}

const NIVEAUX = {
  info: { titre: "Information", icon: Info, box: "border-sky-200 bg-sky-50", accent: "text-sky-800" },
  conseil: { titre: "Conseil", icon: Lightbulb, box: "border-vert-emeraude/30 bg-vert-pale/60", accent: "text-vert-fonce" },
  prudence: { titre: "Prudence", icon: TriangleAlert, box: "border-or/60 bg-or/15", accent: "text-[#8a5a00]" },
  attention: { titre: "Attention", icon: OctagonAlert, box: "border-orange/50 bg-orange/10", accent: "text-[#a04c12]" },
  urgence: { titre: "Urgence médicale", icon: Siren, box: "border-red-300 bg-red-50", accent: "text-red-800" },
} as const

export function Avertissement({ niveau, titre, children }: WithChildren & { niveau?: string; titre?: string }) {
  const config = NIVEAUX[(niveau ?? "info") as keyof typeof NIVEAUX] ?? NIVEAUX.info
  const Icon = config.icon
  return (
    <aside role="note" className={cn("my-8 flex gap-4 rounded-2xl border p-5 sm:p-6", config.box)}>
      <Icon className={cn("mt-0.5 size-6 shrink-0", config.accent)} aria-hidden />
      <div className="min-w-0">
        <p className={cn("mb-1 font-sans text-sm font-bold tracking-wide uppercase", config.accent)}>{titre ?? config.titre}</p>
        <div className="space-y-2 text-[1rem] leading-relaxed text-nuit/90 [&_p]:m-0">{children}</div>
      </div>
    </aside>
  )
}

export function MythesRealites({ mythe, realite, children }: WithChildren & { mythe?: string; realite?: string }) {
  return (
    <section className="my-10 overflow-hidden rounded-2xl border bg-white shadow-sm" aria-label="Mythe ou réalité">
      <div className="grid sm:grid-cols-2">
        <div className="bg-red-50/70 p-6">
          <p className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wider text-red-700 uppercase">
            <CircleX className="size-4" aria-hidden /> Mythe
          </p>
          <p className="m-0 font-heading text-lg text-nuit/80 line-through decoration-red-300">{mythe}</p>
        </div>
        <div className="bg-vert-pale/60 p-6">
          <p className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wider text-vert-fonce uppercase">
            <CircleCheck className="size-4" aria-hidden /> Réalité
          </p>
          <p className="m-0 font-heading text-lg font-semibold text-vert-fonce">{realite}</p>
        </div>
      </div>
      {children && <div className="border-t px-6 py-4 text-[0.98rem] text-nuit/85 [&_p]:m-0">{children}</div>}
    </section>
  )
}

const NIVEAU_LABELS = ["Non évalué", "Très faible", "Faible", "Modéré", "Élevé", "Très élevé"]

export function NiveauPreuve({ note, libelle, children }: WithChildren & { note?: string; libelle?: string }) {
  const value = Math.min(5, Math.max(0, Math.round(Number(note) || 0)))
  return (
    <aside className="my-8 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="m-0 flex items-center gap-2 font-sans text-sm font-bold text-nuit">
          <ShieldAlert className="size-4 text-vert-emeraude" aria-hidden /> {libelle ?? "Niveau de preuve scientifique"}
        </p>
        <div className="flex items-center gap-1.5" role="img" aria-label={`${value} sur 5 : ${NIVEAU_LABELS[value]}`}>
          {Array.from({ length: 5 }, (_, index) => (
            <span
              key={index}
              className={cn("h-2.5 w-7 rounded-full", index < value ? (value >= 4 ? "bg-vert-emeraude" : value >= 3 ? "bg-or" : "bg-orange") : "bg-muted")}
            />
          ))}
          <span className="ml-2 text-sm font-semibold text-nuit">{value}/5 · {NIVEAU_LABELS[value]}</span>
        </div>
      </div>
      {children && <div className="mt-3 text-sm text-muted-foreground [&_p]:m-0">{children}</div>}
    </aside>
  )
}

// ─── Science ──────────────────────────────────────────────────

function sourceNumber(n: string | undefined): string | null {
  return n && /^\d{1,3}$/.test(n) ? n : null
}

/** Référence bibliographique numérotée (cible des appels <Ref n="1" />). */
export function Source({ n, url, children }: WithChildren & { n?: string; url?: string }) {
  const number = sourceNumber(n)
  return (
    <div id={number ? `source-${number}` : undefined} className="source my-2 flex scroll-mt-28 gap-3 text-sm leading-relaxed text-muted-foreground target:rounded-lg target:bg-or/15 [&_p]:m-0">
      {number && <span className="shrink-0 font-semibold text-vert-fonce">[{number}]</span>}
      <div className="min-w-0">
        {children}
        {isSafeHref(url) && isExternalHref(url) && (
          <>
            {" "}
            <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="break-all">
              Consulter la source
            </a>
          </>
        )}
      </div>
    </div>
  )
}

/** Appel de référence [n] dans le texte. */
export function Ref({ n }: { n?: string }) {
  const number = sourceNumber(n)
  if (!number) return null
  return (
    <sup className="ml-0.5">
      <a href={`#source-${number}`} className="font-semibold no-underline" aria-label={`Source ${number}`}>
        [{number}]
      </a>
    </sup>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function AvisExpert({
  nom,
  profession,
  institution,
  photo,
  children,
}: WithChildren & { nom?: string; profession?: string; institution?: string; photo?: string }) {
  return (
    <aside className="my-12 rounded-3xl bg-gradient-to-br from-vert-fonce to-nuit p-7 text-white sm:p-9">
      <p className="mb-5 text-xs font-bold tracking-[0.2em] text-or uppercase">L&apos;avis de l&apos;expert</p>
      <blockquote className="m-0 border-0 p-0 font-heading text-xl leading-relaxed text-white italic sm:text-2xl [&_p]:m-0 [&_strong]:text-or">
        {children}
      </blockquote>
      <div className="mt-6 flex items-center gap-4">
        {isAllowedMediaUrl(photo) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="size-14 rounded-full object-cover ring-2 ring-or" loading="lazy" />
        ) : (
          <span className="flex size-14 items-center justify-center rounded-full bg-or font-heading text-lg font-bold text-nuit">
            {initials(nom ?? "?")}
          </span>
        )}
        <div className="text-sm">
          <p className="m-0 text-base font-semibold">{nom}</p>
          <p className="m-0 text-white/70">{[profession, institution].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
    </aside>
  )
}

// ─── Mise en page ─────────────────────────────────────────────

export function Separateur({ style }: { style?: string }) {
  if (style === "2") {
    return (
      <div className="my-12 flex justify-center gap-3 text-orange" role="separator" aria-hidden>
        <span>●</span><span>●</span><span>●</span>
      </div>
    )
  }
  if (style === "3") {
    return <div role="separator" className="my-12 h-1.5 rounded-full bg-gradient-to-r from-vert-fonce via-vert-emeraude to-or" />
  }
  return (
    <div role="separator" className="my-12 flex items-center gap-4 text-vert-emeraude">
      <span className="h-px flex-1 bg-border" />
      <Leaf className="size-5" aria-hidden />
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

const ENCADRE_COULEURS = {
  vert: "bg-vert-fonce text-white [&_h2]:text-white [&_h3]:text-or [&_strong]:text-or",
  creme: "bg-creme text-nuit",
  nuit: "bg-nuit text-white [&_h2]:text-white [&_h3]:text-or [&_strong]:text-or",
  or: "bg-or/25 text-nuit",
} as const

/** Encadré pleine largeur (sort de la colonne de lecture). */
export function Encadre({ titre, couleur, children }: WithChildren & { titre?: string; couleur?: string }) {
  const colors = ENCADRE_COULEURS[(couleur ?? "creme") as keyof typeof ENCADRE_COULEURS] ?? ENCADRE_COULEURS.creme
  return (
    <section className={cn("pleine-largeur my-14 py-12", colors)}>
      <div className="mx-auto max-w-3xl space-y-4 px-4 sm:px-6">
        {titre && <h2 className="!mt-0 font-heading text-3xl font-bold">{titre}</h2>}
        {children}
      </div>
    </section>
  )
}

// ─── Navigation ───────────────────────────────────────────────

export function BoutonCTA({ href, texte, variante }: { href?: string; texte?: string; variante?: string }) {
  if (!isSafeHref(href)) return null
  const external = isExternalHref(href)
  const className = cn(
    "not-prose inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold no-underline! shadow-sm transition-transform hover:-translate-y-0.5",
    variante === "secondaire" ? "border-2 border-vert-fonce text-vert-fonce! bg-white" : variante === "vert" ? "bg-vert-fonce text-white!" : "bg-orange text-white!",
  )
  const content = (
    <>
      {texte ?? "En savoir plus"} <ArrowRight className="size-4" aria-hidden />
    </>
  )
  return (
    <p className="my-8 text-center">
      {external ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{content}</a>
      ) : (
        <Link href={href} className={className}>{content}</Link>
      )}
    </p>
  )
}

export type TocHeading = { id: string; text: string; depth: 2 | 3 }

/** Sommaire généré à partir des intertitres H2/H3 de l'article. */
export function SommaireView({ headings, titre }: { headings: TocHeading[]; titre?: string }) {
  if (headings.length === 0) {
    return (
      <p className="my-6 flex items-center gap-2 text-sm text-muted-foreground">
        <CircleAlert className="size-4" aria-hidden /> Le sommaire apparaîtra dès que l&apos;article contiendra des intertitres.
      </p>
    )
  }
  return (
    <nav aria-label="Sommaire" className="my-10 rounded-2xl border bg-creme/70 p-6">
      <p className="mb-3 flex items-center gap-2 font-sans text-sm font-bold tracking-wider text-vert-fonce uppercase">
        <ListTree className="size-4" aria-hidden /> {titre ?? "Sommaire"}
      </p>
      <ol className="m-0! list-none! space-y-1.5 p-0!">
        {headings.map((heading) => (
          <li key={heading.id} className={cn("m-0 before:hidden", heading.depth === 3 && "pl-5 text-[0.95rem]")}>
            <a href={`#${heading.id}`} className={cn("no-underline! hover:underline!", heading.depth === 2 ? "font-semibold text-nuit!" : "text-muted-foreground!")}>
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
