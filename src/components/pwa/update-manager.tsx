"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { RefreshCw, X } from "lucide-react"

// ═══════════════════════════════════════════════════════════════
// Mises à jour de l'application (service worker)
// - vérification silencieuse au chargement ;
// - nouvelle version en attente : bannière « Installer maintenant » ;
// - fermée : masquée pour la session, elle revient à la visite suivante ;
// - app passée en arrière-plan avec une mise à jour prête : appliquée
//   automatiquement au retour au premier plan (sauf dans le back-office) ;
// - PWA installée : nouvelle vérification toutes les 30 minutes.
// ═══════════════════════════════════════════════════════════════

const DISMISS_KEY = "vitalya:update-dismissed"
const CHECK_INTERVAL_MS = 30 * 60 * 1000
// Pas de rechargement automatique là où un travail peut être en cours
const NO_AUTO_RELOAD_PREFIXES = ["/admin", "/auth", "/profil"]

function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches
}

export function UpdateManager() {
  const pathname = usePathname()
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [applying, setApplying] = useState(false)
  const reloadingRef = useRef(false)
  const backgroundReadyRef = useRef(false)
  const pathnameRef = useRef(pathname)

  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  /** Active la version en attente ; la page se recharge au changement de contrôleur. */
  const applyUpdate = useCallback((worker: ServiceWorker | null) => {
    if (!worker) return
    setApplying(true)
    worker.postMessage({ type: "SKIP_WAITING" })
  }, [])

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1")
    } catch {
      // Stockage indisponible
    }

    let registration: ServiceWorkerRegistration | undefined
    let interval: number | undefined

    // Rechargement unique lorsque la nouvelle version prend le contrôle.
    // Première installation (aucun contrôleur au chargement) : pas de rechargement.
    const hadController = Boolean(navigator.serviceWorker.controller)
    const onControllerChange = () => {
      if (!hadController || reloadingRef.current) return
      reloadingRef.current = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange)

    const track = (worker: ServiceWorker | null) => {
      if (!worker) return
      const onState = () => {
        // « installed » + page déjà contrôlée = mise à jour (et non première installation)
        if (worker.state === "installed" && navigator.serviceWorker.controller) setWaiting(worker)
      }
      onState()
      worker.addEventListener("statechange", onState)
    }

    const onUpdateFound = () => track(registration?.installing ?? null)

    void navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return
      registration = reg
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting)
      reg.addEventListener("updatefound", onUpdateFound)
      // Vérification silencieuse au chargement
      void reg.update().catch(() => undefined)
      // PWA installée : vérification périodique
      if (isStandalone()) {
        interval = window.setInterval(() => void reg.update().catch(() => undefined), CHECK_INTERVAL_MS)
      }
    })

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange)
      registration?.removeEventListener("updatefound", onUpdateFound)
      window.clearInterval(interval)
    }
  }, [])

  // Mise à jour silencieuse : prête pendant que l'app est en arrière-plan,
  // appliquée au retour au premier plan.
  useEffect(() => {
    if (!waiting) return
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        backgroundReadyRef.current = true
        return
      }
      const path = pathnameRef.current
      const safe = !NO_AUTO_RELOAD_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
      if (backgroundReadyRef.current && safe) applyUpdate(waiting)
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [waiting, applyUpdate])

  function dismiss() {
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, "1")
    } catch {
      // ignoré
    }
  }

  if (!waiting || dismissed) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[80] px-3 pt-[max(0.5rem,env(safe-area-inset-top))] motion-safe:animate-in motion-safe:slide-in-from-top-4 motion-safe:fade-in motion-safe:duration-300"
    >
      <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-vert-fonce py-2.5 pr-2 pl-4 text-white shadow-[0_10px_30px_rgba(13,107,74,0.35)]">
        <RefreshCw className={applying ? "size-4 shrink-0 animate-spin" : "size-4 shrink-0 text-or"} aria-hidden />
        <p className="min-w-0 flex-1 text-sm font-medium">Une mise à jour est disponible</p>
        <button
          type="button"
          onClick={() => applyUpdate(waiting)}
          disabled={applying}
          className="shrink-0 rounded-full bg-orange px-3.5 py-1.5 text-xs font-semibold transition-colors hover:bg-orange/90 disabled:opacity-70"
        >
          {applying ? "Installation…" : "Installer maintenant"}
        </button>
        <button type="button" onClick={dismiss} aria-label="Fermer" className="shrink-0 rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
