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

export function computeReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  return Math.min(300, Math.max(1, Math.round(words / WORDS_PER_MINUTE)))
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
