import { FlaskConical, Globe2, Leaf, ScrollText, Sprout, TriangleAlert } from "lucide-react"
import { isAllowedMediaUrl } from "@/lib/mdx/urls"
import { cn } from "@/lib/utils"

// ═══════════════════════════════════════════════════════════════
// Fiche ingrédient (signature Vitalya) et profil auteur
// ═══════════════════════════════════════════════════════════════

const PREUVE_LABELS = ["Non évalué", "Très faible", "Faible", "Modéré", "Élevé", "Très élevé"]

/** Niveau de preuve visuel : ●●●○○ */
function PreuveDots({ note }: { note: number }) {
  return (
    <span className="inline-flex items-center gap-2" role="img" aria-label={`Niveau de preuve : ${note} sur 5, ${PREUVE_LABELS[note]}`}>
      <span className="text-lg leading-none tracking-[0.15em]" aria-hidden>
        <span className="text-vert-emeraude">{"●".repeat(note)}</span>
        <span className="text-vert-fonce/20">{"○".repeat(5 - note)}</span>
      </span>
      <span className="text-xs font-semibold text-muted-foreground">{PREUVE_LABELS[note]}</span>
    </span>
  )
}

type FicheProps = {
  nom?: string
  nomScientifique?: string
  origine?: string
  partieUtilisee?: string
  utilisationsTraditionnelles?: string
  niveauPreuve?: string
  precautions?: string
}

export function FicheIngredient({
  nom,
  nomScientifique,
  origine,
  partieUtilisee,
  utilisationsTraditionnelles,
  niveauPreuve,
  precautions,
}: FicheProps) {
  const note = Math.min(5, Math.max(0, Math.round(Number(niveauPreuve) || 0)))
  const rows = [
    { icon: Globe2, label: "Origine", value: origine },
    { icon: Sprout, label: "Partie utilisée", value: partieUtilisee },
    { icon: ScrollText, label: "Usages traditionnels", value: utilisationsTraditionnelles },
  ].filter((row) => row.value)

  return (
    <article className="fiche-ingredient my-12 overflow-hidden rounded-3xl border-2 border-vert-fonce/15 bg-white shadow-sm" aria-label={`Fiche ingrédient : ${nom ?? ""}`}>
      <header className="relative flex items-center gap-4 overflow-hidden bg-vert-fonce px-6 py-5 text-white">
        <Leaf aria-hidden className="absolute -right-6 -bottom-8 size-32 rotate-12 text-white/10" />
        <span className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
          <Leaf className="size-6 text-or" aria-hidden />
        </span>
        <div className="relative min-w-0">
          <p className="m-0! text-[0.65rem] font-bold tracking-[0.25em] text-or uppercase">Fiche ingrédient Vitalya</p>
          <p className="m-0! font-heading text-2xl leading-tight font-bold">{nom}</p>
          {nomScientifique && <p className="m-0! font-heading text-sm text-white/75 italic">{nomScientifique}</p>}
        </div>
      </header>

      <dl className="m-0! divide-y">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="grid gap-1 px-6 py-3.5 sm:grid-cols-[11rem_1fr] sm:gap-4">
            <dt className="flex items-center gap-2 text-xs font-bold tracking-wider text-vert-fonce uppercase">
              <Icon className="size-4 text-vert-emeraude" aria-hidden /> {label}
            </dt>
            <dd className="m-0 text-[0.95rem] leading-relaxed text-nuit/85">{value}</dd>
          </div>
        ))}
        <div className="grid gap-1 px-6 py-3.5 sm:grid-cols-[11rem_1fr] sm:gap-4">
          <dt className="flex items-center gap-2 text-xs font-bold tracking-wider text-vert-fonce uppercase">
            <FlaskConical className="size-4 text-vert-emeraude" aria-hidden /> Niveau de preuve
          </dt>
          <dd className="m-0">
            <PreuveDots note={note} />
          </dd>
        </div>
      </dl>

      {precautions && (
        <footer className="flex gap-3 bg-or/15 px-6 py-4 text-sm leading-relaxed text-nuit">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[#a86f00]" aria-hidden />
          <p className="m-0!">
            <strong className="text-[#7a5200]">Précautions : </strong>
            {precautions}
          </p>
        </footer>
      )}
    </article>
  )
}

export type AuthorProfile = {
  name: string
  photo_url: string | null
  bio: string | null
  specialty: string | null
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

/** Profil de l'auteur, affiché en fin d'article. */
export function ProfilAuteur({ author, className }: { author: AuthorProfile; className?: string }) {
  return (
    <aside className={cn("my-12 flex flex-col gap-5 rounded-3xl border bg-creme/70 p-6 sm:flex-row sm:items-center sm:p-7", className)} aria-label="À propos de l'auteur">
      {isAllowedMediaUrl(author.photo_url) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={author.photo_url} alt="" className="size-20 shrink-0 rounded-full object-cover ring-4 ring-white" loading="lazy" />
      ) : (
        <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-vert-fonce font-heading text-2xl font-bold text-or ring-4 ring-white">
          {initials(author.name)}
        </span>
      )}
      <div className="min-w-0">
        <p className="m-0 text-[0.65rem] font-bold tracking-[0.25em] text-orange uppercase">Écrit par</p>
        <p className="m-0 font-heading text-2xl font-bold text-nuit">{author.name}</p>
        {author.specialty && <p className="m-0 text-sm font-medium text-vert-fonce">{author.specialty}</p>}
        {author.bio && <p className="m-0 mt-2 text-sm leading-relaxed text-nuit/75">{author.bio}</p>}
      </div>
    </aside>
  )
}
