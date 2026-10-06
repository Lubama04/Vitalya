"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

/** Comptabilise une vue (une seule fois par session de navigateur). */
export function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `vitalya:vu:${slug}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, "1")
    } catch {
      // Stockage indisponible (navigation privée) : on compte quand même
    }
    void createClient().rpc("increment_article_view", { p_slug: slug })
  }, [slug])

  return null
}
