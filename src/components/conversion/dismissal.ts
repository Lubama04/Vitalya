"use client"

// Mémorisation des messages fermés. Le stockage du navigateur peut être indisponible
// (navigation privée, cookies bloqués) : chaque accès est protégé et, dans le doute, le message reste affiché.

const DAY_MS = 24 * 60 * 60 * 1000

/** Fermeture valable pour la visite en cours (le message revient à la prochaine visite). */
export function isDismissedForSession(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === "1"
  } catch {
    return false
  }
}

export function dismissForSession(key: string): void {
  try {
    window.sessionStorage.setItem(key, "1")
  } catch {
    // Stockage indisponible : le message sera simplement réaffiché
  }
}

/** Fermeture valable un nombre de jours donné. */
export function isDismissedForDays(key: string): boolean {
  try {
    const until = Number(window.localStorage.getItem(key))
    return Number.isFinite(until) && until > Date.now()
  } catch {
    return false
  }
}

export function dismissForDays(key: string, days: number): void {
  try {
    window.localStorage.setItem(key, String(Date.now() + days * DAY_MS))
  } catch {
    // Stockage indisponible : le message sera simplement réaffiché
  }
}
