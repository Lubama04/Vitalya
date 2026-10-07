// Constantes métier partagées (client + serveur)

export const SITE = {
  name: "Vitalya",
  slogan: "Vivre mieux, naturellement.",
  description:
    "Le magazine digital francophone de la santé, de la beauté et du bien-être africain.",
  tagline: "Santé · Beauté · Bien-être",
  locale: "fr_FR",
} as const

export const ACCESS_LEVELS = ["free", "premium", "expert"] as const
export type AccessLevel = (typeof ACCESS_LEVELS)[number]

export const ROLES = ["reader", "editor", "admin"] as const
export type Role = (typeof ROLES)[number]

export const READING_MODES = ["scroll", "book"] as const
export type ReadingMode = (typeof READING_MODES)[number]

export function isReadingMode(value: unknown): value is ReadingMode {
  return value === "scroll" || value === "book"
}

export const ACCESS_LABELS: Record<AccessLevel, string> = {
  free: "Gratuit",
  premium: "Premium",
  expert: "Expert",
}

export const ROLE_LABELS: Record<Role, string> = {
  reader: "Lecteur",
  editor: "Éditeur",
  admin: "Administrateur",
}

/** Rang d'un niveau d'accès (identique à public.tier_rank en base). */
export function tierRank(tier: AccessLevel): number {
  return tier === "expert" ? 2 : tier === "premium" ? 1 : 0
}

export function isAccessLevel(value: unknown): value is AccessLevel {
  return typeof value === "string" && (ACCESS_LEVELS as readonly string[]).includes(value)
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value)
}

export type PricingTier = {
  id: AccessLevel
  name: string
  price: number
  description: string
  features: string[]
  highlighted?: boolean
}

export const PRICING: PricingTier[] = [
  {
    id: "free",
    name: "Gratuit",
    price: 0,
    description: "Pour découvrir Vitalya et ses conseils essentiels.",
    features: [
      "Articles gratuits en illimité",
      "Newsletter hebdomadaire",
      "Commentaires et favoris",
      "Application installable (PWA)",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: 5,
    description: "Pour aller plus loin dans votre routine santé et beauté.",
    features: [
      "Tout le contenu Gratuit",
      "Tous les articles Premium",
      "Dossiers thématiques complets",
      "Lecture hors ligne",
      "Sans publicité",
    ],
    highlighted: true,
  },
  {
    id: "expert",
    name: "Expert",
    price: 10,
    description: "L'accès intégral, avec l'éclairage de nos spécialistes.",
    features: [
      "Tout le contenu Premium",
      "Articles Expert & Science",
      "Analyses de spécialistes de santé",
      "Accès anticipé aux nouveaux numéros",
      "Soutien direct à la rédaction",
    ],
  },
]

/** Nombre de mots lus par minute pour le calcul du temps de lecture. */
export const WORDS_PER_MINUTE = 200

/**
 * Nombre de mots réellement lus : balises MDX, attributs, URLs et
 * syntaxe Markdown sont ignorés. Utilisé à l'identique par l'éditeur
 * (temps réel) et par le serveur (enregistrement) : valeurs synchronisées.
 */
export function countWords(content: string): number {
  const text = content
    .replace(/```[\s\S]*?```/g, " ") // blocs de code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images Markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // liens : on garde le texte
    .replace(/<\/?[A-Za-z][^>]*>/g, " ") // balises JSX / HTML et leurs attributs
    .replace(/https?:\/\/\S+/g, " ") // URLs nues
    .replace(/[#*_>`~|=[\]{}-]+/g, " ") // syntaxe Markdown
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length
}

export function computeReadingTime(content: string): number {
  return Math.min(300, Math.max(1, Math.round(countWords(content) / WORDS_PER_MINUTE)))
}

/** Transforme un titre en slug ASCII (accents retirés). */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "")
}

/** Luminance relative WCAG d'une couleur hexadécimale (#RRGGBB). */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => {
    const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
}

/** Couleur de texte (nuit ou blanc) offrant le meilleur contraste WCAG sur un fond donné. */
export function textOn(background: string): string {
  const bg = luminance(background)
  const contrastWhite = 1.05 / (bg + 0.05)
  const contrastNuit = (bg + 0.05) / (luminance("#1E2532") + 0.05)
  return contrastNuit > contrastWhite ? "#1E2532" : "#FFFFFF"
}

/** Couleur d'accent lisible sur fond blanc (assombrit les couleurs trop claires). */
export function accentOnWhite(color: string): string {
  if (color.toUpperCase() === "#F4B942") return "#A86F00"
  if (color.toUpperCase() === "#E8813A") return "#C2601B"
  return color
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

export function formatDate(iso: string | null): string {
  if (!iso) return ""
  return dateFormatter.format(new Date(iso))
}
