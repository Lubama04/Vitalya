"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Download, Share, X } from "lucide-react"
import { Button } from "@/components/ui/button"

// ═══════════════════════════════════════════════════════════════
// Bannière d'installation PWA, volontairement discrète :
// - rien au chargement : on laisse lire ;
// - apparition après 2 min de lecture active OU 60 % de défilement ;
// - fermeture (ou refus dans l'invite native) : masquée 30 jours ;
// - installation acceptée / application installée : plus jamais.
// ═══════════════════════════════════════════════════════════════

/** Événement non standard (Chromium) : absent des types DOM. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

declare global {
  interface Window {
    /** Événement capturé avant l'hydratation (voir INSTALL_CAPTURE_SCRIPT). */
    __vitalyaInstallPrompt?: BeforeInstallPromptEvent | null
  }
}

const STORAGE_KEY = "vitalya:pwa-install"
const SESSION_TIME_KEY = "vitalya:pwa-reading-ms"
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000
const READING_THRESHOLD_MS = 2 * 60 * 1000
const SCROLL_THRESHOLD = 0.6
// Pages où l'on ne dérange pas (outils, authentification)
const EXCLUDED_PREFIXES = ["/admin", "/auth", "/hors-ligne", "/newsletter"]

type StoredState =
  | { status: "dismissed"; until: number }
  | { status: "accepted" }
  | { status: "installed" }

function readState(): StoredState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredState) : null
  } catch {
    return null
  }
}

function writeState(state: StoredState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Stockage indisponible (navigation privée) : la bannière pourra réapparaître
  }
}

/** Faut-il encore proposer l'installation ? */
function isEligible(): boolean {
  const state = readState()
  if (!state) return true
  if (state.status === "dismissed") return Date.now() >= state.until
  return false
}

function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches
}

/** Safari iOS : pas d'invite native, installation via « Sur l'écran d'accueil ». */
function isIosSafari(): boolean {
  const ua = navigator.userAgent
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  return ios && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua)
}

export function InstallBanner() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [iosHelp, setIosHelp] = useState(false)
  const [mode, setMode] = useState<"native" | "ios" | null>(null)
  const triggeredRef = useRef(false)

  // ─── Détection de l'installabilité ───
  useEffect(() => {
    if (isStandalone()) {
      writeState({ status: "installed" })
      return
    }
    if (!isEligible()) return

    if (isIosSafari()) {
      setMode("ios")
      return
    }
    if (window.__vitalyaInstallPrompt) setMode("native")
    const onInstallable = () => setMode("native")
    const onInstalled = () => {
      writeState({ status: "installed" })
      setVisible(false)
      setMode(null)
    }
    window.addEventListener("vitalya:installable", onInstallable)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("vitalya:installable", onInstallable)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  const reveal = useCallback(() => {
    if (triggeredRef.current) return
    triggeredRef.current = true
    if (isEligible()) setVisible(true)
  }, [])

  // ─── Déclencheur 1 : 2 minutes de lecture active (onglet visible) ───
  // Le temps est cumulé sur la session, y compris entre les pages.
  useEffect(() => {
    if (!mode || triggeredRef.current) return
    let elapsed = 0
    try {
      elapsed = Number(sessionStorage.getItem(SESSION_TIME_KEY)) || 0
    } catch {
      elapsed = 0
    }
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      elapsed += 1000
      try {
        sessionStorage.setItem(SESSION_TIME_KEY, String(elapsed))
      } catch {
        // ignoré
      }
      if (elapsed >= READING_THRESHOLD_MS) {
        window.clearInterval(interval)
        reveal()
      }
    }, 1000)
    return () => window.clearInterval(interval)
  }, [mode, reveal])

  // ─── Déclencheur 2 : 60 % de la page parcourue ───
  useEffect(() => {
    if (!mode || triggeredRef.current) return
    // Calcul direct (deux lectures de layout) : léger et indépendant de requestAnimationFrame
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      if (scrollable > 200 && window.scrollY / scrollable >= SCROLL_THRESHOLD) reveal()
    }
    // Pas de vérification initiale : une position restaurée par le navigateur
    // (rechargement, retour arrière) ne compte pas comme une lecture.
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [mode, reveal, pathname])

  function dismiss() {
    writeState({ status: "dismissed", until: Date.now() + SNOOZE_MS })
    setVisible(false)
  }

  async function install() {
    if (mode === "ios") {
      setIosHelp(true)
      return
    }
    const promptEvent = window.__vitalyaInstallPrompt
    if (!promptEvent) {
      setVisible(false)
      return
    }
    // L'invite ne peut servir qu'une fois
    window.__vitalyaInstallPrompt = null
    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    // Acceptée : définitif ; refusée dans l'invite native : même règle que la croix
    writeState(outcome === "accepted" ? { status: "accepted" } : { status: "dismissed", until: Date.now() + SNOOZE_MS })
    setVisible(false)
  }

  const excluded = EXCLUDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  if (!visible || !mode || excluded) return null

  return (
    <div
      role="region"
      aria-label="Installer l'application Vitalya"
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] motion-safe:animate-in motion-safe:slide-in-from-bottom-4 motion-safe:fade-in motion-safe:duration-500 sm:px-4"
    >
      <div className="mx-auto flex max-w-2xl items-center gap-3 rounded-2xl border border-vert-emeraude/20 bg-white/95 p-3 shadow-[0_8px_30px_rgba(13,107,74,0.18)] backdrop-blur sm:gap-4 sm:p-4">
        <Image src="/icons/icon-96.png" alt="" width={44} height={44} className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-nuit">Installez Vitalya pour lire hors ligne</p>
          {iosHelp ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Touchez <Share className="inline size-3.5 align-text-bottom text-vert-fonce" aria-label="Partager" /> puis
              « Sur l&apos;écran d&apos;accueil ».
            </p>
          ) : (
            <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
              Accès en un geste depuis votre écran d&apos;accueil, même sans réseau.
            </p>
          )}
        </div>
        {!iosHelp && (
          <Button type="button" size="sm" onClick={install} className="h-9 shrink-0 bg-vert-fonce px-3 text-white hover:bg-vert-fonce/90">
            <Download className="size-4" /> Installer
          </Button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer et ne plus proposer pendant 30 jours"
          className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-nuit"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
