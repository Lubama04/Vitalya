import { createClient } from "@/lib/supabase/client"

// Upload vers le bucket public « article-media » (écriture réservée à l'équipe par RLS).
// Le bucket impose aussi types MIME et taille côté serveur.

export const MEDIA_RULES = {
  image: { types: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"], maxBytes: 10 * 1024 * 1024, label: "JPEG, PNG, WebP, AVIF ou GIF · 10 Mo max" },
  video: { types: ["video/mp4", "video/webm"], maxBytes: 50 * 1024 * 1024, label: "MP4 ou WebM · 50 Mo max" },
  audio: {
    types: ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/ogg", "audio/wav", "audio/webm"],
    maxBytes: 50 * 1024 * 1024,
    label: "MP3, M4A, AAC, OGG, WAV ou WebM · 50 Mo max",
  },
} as const

export type MediaKind = keyof typeof MEDIA_RULES

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "weba",
}

// Dossiers du bucket « article-media »
const FOLDERS: Record<MediaKind, string> = { image: "images", video: "videos", audio: "audio" }

export function validateMedia(file: File, kind: MediaKind): string | null {
  const rules = MEDIA_RULES[kind]
  if (!(rules.types as readonly string[]).includes(file.type)) return `Format non accepté (${rules.label}).`
  if (file.size > rules.maxBytes) return `Fichier trop lourd (${rules.label}).`
  return null
}

/** Importe un fichier et renvoie son URL publique. */
export async function uploadMedia(file: File, kind: MediaKind): Promise<string> {
  const error = validateMedia(file, kind)
  if (error) throw new Error(error)

  const supabase = createClient()
  const now = new Date()
  // Nom généré : le nom d'origine n'est jamais conservé
  const path = `${FOLDERS[kind]}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${EXTENSIONS[file.type] ?? "bin"}`
  const { error: uploadError } = await supabase.storage.from("article-media").upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  })
  if (uploadError) throw new Error("Import impossible. Vérifiez vos droits et la taille du fichier.")
  return supabase.storage.from("article-media").getPublicUrl(path).data.publicUrl
}
