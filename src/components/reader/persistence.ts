import { setReadingMode } from "@/actions/profile"
import { isReadingMode, type ReadingMode } from "@/lib/constants"
import { createClient } from "@/lib/supabase/client"

// ═══════════════════════════════════════════════════════════════
// Persistance du lecteur
// - Mode préféré : profil Supabase si connecté, sinon localStorage
// - Position par article : localStorage (immédiat) + Supabase (différé)
// ═══════════════════════════════════════════════════════════════

const MODE_KEY = "vitalya:reading-mode"
const positionKey = (articleId: string) => `vitalya:position:${articleId}`

export type SavedPosition = {
  progress: number // 0 → 1, commun aux deux modes
  page: number | null // page du mode livre (indice 0)
  mode: ReadingMode
  updatedAt: number
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Stockage indisponible (navigation privée) : on ignore
  }
}

export function readLocalMode(): ReadingMode | null {
  const value = safeGet(MODE_KEY)
  return isReadingMode(value) ? value : null
}

export async function persistMode(mode: ReadingMode, signedIn: boolean) {
  safeSet(MODE_KEY, mode)
  if (signedIn) await setReadingMode(mode)
}

function parseLocal(articleId: string): SavedPosition | null {
  try {
    const raw = safeGet(positionKey(articleId))
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<SavedPosition>
    if (typeof value.progress !== "number" || !isReadingMode(value.mode)) return null
    return {
      progress: Math.min(1, Math.max(0, value.progress)),
      page: typeof value.page === "number" ? value.page : null,
      mode: value.mode,
      updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : 0,
    }
  } catch {
    return null
  }
}

/** Position la plus récente entre l'appareil et le compte. */
export async function loadPosition(articleId: string, userId: string | null): Promise<SavedPosition | null> {
  const local = parseLocal(articleId)
  if (!userId) return local

  const { data } = await createClient()
    .from("reading_positions")
    .select("progress, page, mode, updated_at")
    .eq("article_id", articleId)
    .maybeSingle()
  if (!data || !isReadingMode(data.mode)) return local

  const remote: SavedPosition = {
    progress: data.progress,
    page: data.page,
    mode: data.mode,
    updatedAt: new Date(data.updated_at).getTime(),
  }
  return !local || remote.updatedAt > local.updatedAt ? remote : local
}

/** Enregistreur de position : localStorage à chaque appel, Supabase au plus toutes les 4 s. */
export function createPositionSaver(articleId: string, userId: string | null) {
  let pending: SavedPosition | null = null
  let timer: number | undefined

  const flushRemote = () => {
    window.clearTimeout(timer)
    timer = undefined
    if (!userId || !pending) return
    const position = pending
    pending = null
    void createClient()
      .from("reading_positions")
      .upsert(
        {
          user_id: userId,
          article_id: articleId,
          progress: Number(position.progress.toFixed(4)),
          page: position.page,
          mode: position.mode,
        },
        { onConflict: "user_id,article_id" },
      )
      .then(() => undefined)
  }

  return {
    save(position: Omit<SavedPosition, "updatedAt">) {
      const value: SavedPosition = { ...position, updatedAt: Date.now() }
      safeSet(positionKey(articleId), JSON.stringify(value))
      pending = value
      if (userId && timer === undefined) timer = window.setTimeout(flushRemote, 4000)
    },
    flush: flushRemote,
  }
}
