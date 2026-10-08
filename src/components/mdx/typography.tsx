import type { CSSProperties, ReactNode } from "react"
import { Info, Quote } from "lucide-react"
import { colorHex, fontFamily } from "@/lib/mdx/typo"
import { cn } from "@/lib/utils"

// ═══════════════════════════════════════════════════════════════
// Styles typographiques Vitalya
// « police » et « couleur » sont des clés du référentiel (typo.ts) :
// une valeur inconnue est ignorée, jamais injectée telle quelle en CSS.
// Les titres rendent de vrais h2/h3 ancrés (sommaire, table des matières).
// ═══════════════════════════════════════════════════════════════

type TypoProps = { children?: ReactNode; police?: string; couleur?: string; id?: string }

function typoStyle(police?: string, couleur?: string): CSSProperties | undefined {
  const style: CSSProperties = {}
  const family = fontFamily(police)
  const color = colorHex(couleur)
  if (family) style.fontFamily = family
  if (color) style.color = color
  return Object.keys(style).length ? style : undefined
}

/** Titre éditorial : grand titre d'ouverture de section, avec surtitre. */
export function TitreEditorial({ children, police, couleur, id, surtitre }: TypoProps & { surtitre?: string }) {
  return (
    <header className="mt-16 mb-8">
      {surtitre && <p className="mb-3 text-xs font-bold tracking-[0.25em] text-orange uppercase">{surtitre}</p>}
      <h2 id={id} className="m-0! scroll-mt-28 font-heading text-4xl leading-[1.08] font-bold text-balance text-nuit sm:text-5xl" style={typoStyle(police, couleur)}>
        {children}
      </h2>
      <div className="mt-5 flex items-center gap-2" aria-hidden>
        <span className="h-1 w-14 rounded-full bg-vert-fonce" />
        <span className="h-1 w-4 rounded-full bg-orange" />
      </div>
    </header>
  )
}

/** Grand intertitre : sépare les grandes parties de l'article. */
export function GrandIntertitre({ children, police, couleur, id }: TypoProps) {
  return (
    <h2
      id={id}
      className="mt-14! mb-6! scroll-mt-28 border-b-2 border-vert-pale pb-3 font-heading text-3xl! leading-tight font-bold text-vert-fonce sm:text-[2.4rem]!"
      style={typoStyle(police, couleur)}
    >
      {children}
    </h2>
  )
}

/** Intertitre élégant : italique fin, filet orange. */
export function IntertitreElegant({ children, police, couleur, id }: TypoProps) {
  return (
    <h3
      id={id}
      className="mt-10! mb-4! flex scroll-mt-28 items-center gap-3 font-heading text-2xl! font-medium text-vert-fonce italic before:h-px before:w-8 before:shrink-0 before:bg-orange"
      style={typoStyle(police, couleur)}
    >
      {children}
    </h3>
  )
}

/** Citation forte : exergue centrée sur toute la colonne. */
export function CitationForte({ children, auteur, police, couleur }: TypoProps & { auteur?: string }) {
  return (
    <figure className="my-14 border-y-2 border-vert-fonce/15 px-2 py-10 text-center">
      <Quote className="mx-auto mb-4 size-10 rotate-180 text-orange" aria-hidden />
      <blockquote className="m-0 border-0 p-0 font-heading text-3xl leading-snug font-semibold text-balance text-vert-fonce sm:text-4xl [&_p]:m-0" style={typoStyle(police, couleur)}>
        {children}
      </blockquote>
      {auteur && <figcaption className="mt-5 text-sm font-semibold tracking-wider text-muted-foreground uppercase">{auteur}</figcaption>}
    </figure>
  )
}

/** Mise en avant : paragraphe surligné, plus grand. */
export function MiseEnAvant({ children, police, couleur }: TypoProps) {
  return (
    <div
      className="my-8 rounded-r-xl border-l-4 border-orange bg-gradient-to-r from-orange/10 to-transparent py-4 pr-4 pl-6 text-xl leading-relaxed font-medium text-nuit [&_p]:m-0"
      style={typoStyle(police, couleur)}
    >
      {children}
    </div>
  )
}

/** Légende : petit texte d'accompagnement (sous une image, un tableau…). */
export function Legende({ children, couleur }: TypoProps) {
  return (
    <p className="-mt-2! text-center text-sm leading-snug text-muted-foreground italic" style={typoStyle(undefined, couleur)}>
      {children}
    </p>
  )
}

/** Note de bas : précision, avertissement de lecture, mention légale. */
export function NoteBas({ children, couleur }: TypoProps) {
  return (
    <aside className="mt-10 flex gap-2 border-t pt-4 text-[0.85rem] leading-relaxed text-muted-foreground [&_p]:m-0" style={typoStyle(undefined, couleur)}>
      <Info className="mt-0.5 size-4 shrink-0 text-vert-emeraude" aria-hidden />
      <div>{children}</div>
    </aside>
  )
}

/** Couleur de texte en ligne, limitée à la palette sémantique Vitalya. */
export function Couleur({ children, valeur }: { children?: ReactNode; valeur?: string }) {
  const color = colorHex(valeur)
  if (!color) return <>{children}</>
  // Les teintes claires reçoivent un fond sombre discret pour rester lisibles
  const light = valeur === "blanc" || valeur === "creme"
  return (
    <span style={{ color }} className={cn(light && "rounded bg-nuit px-1")}>
      {children}
    </span>
  )
}

export { typoStyle }
