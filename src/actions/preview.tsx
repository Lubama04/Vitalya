"use server"

import type { ReactNode } from "react"
import { MdxContent } from "@/components/mdx/mdx-content"
import { getViewer, isStaff } from "@/lib/auth"

const MAX_LENGTH = 200000

/**
 * Aperçu MDX de l'éditeur : compilé côté serveur avec exactement le même
 * moteur (et la même liste blanche) que la page publique. Réservé à l'équipe.
 */
export async function renderMdxPreview(source: string, categoryId?: string): Promise<ReactNode> {
  const viewer = await getViewer()
  if (!isStaff(viewer)) return <div className="text-sm text-red-600">Accès refusé.</div>
  if (typeof source !== "string" || source.length > MAX_LENGTH) {
    return <div className="text-sm text-red-600">Contenu trop long pour l&apos;aperçu.</div>
  }
  if (!source.trim()) {
    return <div className="text-sm text-muted-foreground">L&apos;aperçu s&apos;affichera ici au fil de la saisie.</div>
  }
  const safeCategory = typeof categoryId === "string" && /^[0-9a-f-]{36}$/i.test(categoryId) ? categoryId : undefined
  return <MdxContent source={source} context={{ categoryId: safeCategory }} preview />
}
