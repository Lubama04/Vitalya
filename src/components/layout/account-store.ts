"use client"

import { useSyncExternalStore } from "react"
import type { AccessLevel } from "@/lib/constants"

// État du compte connecté, partagé entre l'en-tête et le menu mobile (résolu dans le navigateur).
export type Account = {
  name: string
  email: string
  avatarUrl: string | null
  tier: AccessLevel
  isStaff: boolean
  isAdmin: boolean
}

let current: Account | null = null
const listeners = new Set<() => void>()

export function setAccount(account: Account | null) {
  current = account
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
