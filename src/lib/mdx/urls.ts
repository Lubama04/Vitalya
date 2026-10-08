import { publicEnv } from "@/lib/env"

// Validation des URLs utilisées dans le contenu MDX (client + serveur).

const STORAGE_PREFIX = `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`
const MEDIA_BUCKETS = ["article-media", "covers"] as const

/** Média hébergé par Vitalya : stockage Supabase (buckets autorisés) ou fichier local. */
export function isAllowedMediaUrl(url: unknown): url is string {
  if (typeof url !== "string" || url.length > 600) return false
  if (/^\/(covers|brand)\/[\w./-]+$/.test(url) && !url.includes("..")) return true
  if (!url.startsWith(STORAGE_PREFIX)) return false
  const rest = url.slice(STORAGE_PREFIX.length)
  return MEDIA_BUCKETS.some((bucket) => rest.startsWith(`${bucket}/`)) && !rest.includes("..")
}

/** Lien autorisé : http(s), mailto, chemin interne ou ancre. */
export function isSafeHref(href: unknown): href is string {
  return typeof href === "string" && href.length <= 2000 && /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(href)
}

export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

/** Identifiant de vidéo YouTube (11 caractères) depuis un id ou une URL. */
export function parseYouTubeId(input: string): string | null {
  const value = input.trim()
  if (/^[\w-]{11}$/.test(value)) return value
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\.|^m\./, "")
    let id: string | null = null
    if (host === "youtu.be") id = url.pathname.slice(1)
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      id = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/)?.[1] ?? null
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null
  } catch {
    return null
  }
}

/** Ancre d'un intertitre (identique côté rendu et sommaire). */
export function headingId(text: string, used: Map<string, number>): string {
  const base =
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "section"
  const count = used.get(base) ?? 0
  used.set(base, count + 1)
  return count === 0 ? base : `${base}-${count + 1}`
}
