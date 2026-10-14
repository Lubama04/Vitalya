"use client"

import { useSyncExternalStore } from "react"
import type { AccessLevel } from "@/lib/constants"

// État du compte connecté, partagé entre l'en-tête et le menu mobile (résolu dans le navigateur).
export type Account = {
  name: string
  /** Prénom (premier mot du nom complet), null si le profil n'a pas de nom. */
  firstName: string | null
  email: string
  avatarUrl: string | null
  tier: AccessLevel
  isStaff: boolean
  isAdmin: boolean
}

let current: Account | null = null
// Faux tant que la session n'a pas été lue : évite d'afficher un message « invité » à un lecteur connecté
let resolved = false
const listeners = new Set<() => void>()

export function setAccount(account: Account | null) {
  current = account
  resolved = true
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useAccount(): Account | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  )
}

/** Compte connu : « loading » tant que la session n'est pas résolue, puis null (invité) ou le compte. */
export function useAccountState(): Account | null | "loading" {
  return useSyncExternalStore(
    subscribe,
    () => (resolved ? current : "loading"),
    () => "loading",
  )
}
