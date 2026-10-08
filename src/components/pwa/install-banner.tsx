"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Download, Share, SquarePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// ═══════════════════════════════════════════════════════════════
// Installation de la PWA
// 1. Bouton permanent « Installer Vitalya » (bas de page, centré) :
//    visible tant que l'app n'est pas installée. Chrome n'émet
//    beforeinstallprompt que si l'app n'est pas installée : après une
//    désinstallation, l'événement revient et le bouton réapparaît.
// 2. Bannière contextuelle (2 min de lecture active ou 60 % de
//    défilement) : « Installer » ou « Plus tard » (30 jours).
// 3. iOS : pas d'invite native, fenêtre d'instructions.
// ═══════════════════════════════════════════════════════════════

/** Événement non standard (Chromium) : absent des types DOM. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

declare global {
  interface Window {
    /** Événement capturé avant l'hydratation (voir install-capture.ts). */
    __vitalyaInstallPrompt?: BeforeInstallPromptEvent | null
  }
}

const STORAGE_KEY = "vitalya:pwa-install"
const SESSION_TIME_KEY = "vitalya:pwa-reading-ms"
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000
const READING_THRESHOLD_MS = 2 * 60 * 1000
const SCROLL_THRESHOLD = 0.6
// Bouton permanent : partout sauf back-office, authentification, hors ligne
const BUTTON_EXCLUDED = ["/admin", "/auth", "/hors-ligne"]
// Bannière : on ne dérange pas non plus sur les pages de newsletter
const BANNER_EXCLUDED = [...BUTTON_EXCLUDED, "/newsletter"]

type StoredState = { status: "dismissed"; until: number } | { status: "accepted" } | { status: "installed" }

function readState(): StoredState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredState) : null
  } catch {
    return null
  }
}

function writeState(state: StoredState | null) {
  try {
    if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Stockage indisponible (navigation privée)
  }
}

/** La bannière contextuelle peut-elle être proposée ? */
function bannerEligible(): boolean {
  const state = readState()
  if (!state) return true
  if (state.status === "dismissed") return Date.now() >= state.until
  return false
}

function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches
}

/** Safari iOS : installation via « Sur l'écran d'accueil ». */
function isIosSafari(): boolean {
  const ua = navigator.userAgent
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  return ios && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua)
}

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function InstallBanner() {
  const pathname = usePathname()
  const [mode, setMode] = useState<"native" | "ios" | null>(null)
  const [installed, setInstalled] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(false)
  const [iosHelp, setIosHelp] = useState(false)
  const triggeredRef = useRef(false)

  // ─── Installabilité ───
  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true)
      writeState({ status: "installed" })
      return
    }
    if (isIosSafari()) {
      setMode("ios")
      return
    }
    const onInstallable = () => {
      // L'invite revient : l'app n'est pas (ou plus) installée
      if (readState()?.status === "installed") writeState(null)
      setInstalled(false)
      setMode("native")
    }
    const onInstalled = () => {
      writeState({ status: "installed" })
      setInstalled(true)
      setBannerVisible(false)
      setMode(null)
    }
    if (window.__vitalyaInstallPrompt) onInstallable()
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
    if (bannerEligible()) setBannerVisible(true)
  }, [])

  // ─── Bannière, déclencheur 1 : 2 minutes de lecture active ───
  useEffect(() => {
    if (!mode || installed || triggeredRef.current) return
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
  }, [mode, installed, reveal])

  // ─── Bannière, déclencheur 2 : 60 % de la page réellement parcourue ───
  useEffect(() => {
    if (!mode || installed || triggeredRef.current) return
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      if (scrollable > 200 && window.scrollY / scrollable >= SCROLL_THRESHOLD) reveal()
    }
    // Pas de vérification initiale : une position restaurée ne compte pas
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [mode, installed, reveal, pathname])

  function later() {
    writeState({ status: "dismissed", until: Date.now() + SNOOZE_MS })
    setBannerVisible(false)
  }

  async function install() {
    if (mode === "ios") {
      setIosHelp(true)
      return
    }
    const promptEvent = window.__vitalyaInstallPrompt
    if (!promptEvent) return
    // L'invite native ne sert qu'une fois
    window.__vitalyaInstallPrompt = null
    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === "accepted") {
      writeState({ status: "accepted" })
      setInstalled(true)
    } else if (bannerVisible) {
      writeState({ status: "dismissed", until: Date.now() + SNOOZE_MS })
    }
    setBannerVisible(false)
    // Sans nouvelle invite, Chrome n'en émettra pas d'autre avant le prochain chargement
    if (outcome !== "accepted") setMode(null)
  }

  if (!mode || installed) return null

  const showBanner = bannerVisible && !matches(pathname, BANNER_EXCLUDED)
  const showButton = !showBanner && !matches(pathname, BUTTON_EXCLUDED)

  return (
    <>
      {/* ─── Bouton permanent ─── */}
      {showButton && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={install}
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-[#0D6B4A] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(13,107,74,0.28)] transition-transform hover:-translate-y-0.5 hover:bg-[#0b5c40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8813A] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
          >
            <Download className="size-4" aria-hidden /> Installer Vitalya
          </button>
        </div>
      )}

      {/* ─── Bannière contextuelle ─── */}
      {showBanner && (
        <div
          role="region"
          aria-label="Installer l'application Vitalya"
          className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] motion-safe:animate-in motion-safe:slide-in-from-bottom-4 motion-safe:fade-in motion-safe:duration-500 sm:px-4"
        >
          <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-3 rounded-2xl border border-vert-emeraude/20 bg-white/95 p-3 shadow-[0_8px_30px_rgba(13,107,74,0.18)] backdrop-blur sm:flex-nowrap sm:gap-4 sm:p-4">
            <Image src="/icons/icon-96.png" alt="" width={48} height={48} className="size-12 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-nuit">Installez Vitalya</p>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                Lisez hors ligne, sans publicité, sur tous vos appareils
              </p>
            </div>
            <div className="flex w-full shrink-0 gap-2 sm:w-auto">
              <Button type="button" size="sm" variant="ghost" onClick={later} className="h-9 flex-1 text-muted-foreground sm:flex-none">
                Plus tard
              </Button>
              <Button type="button" size="sm" onClick={install} className="h-9 flex-1 bg-vert-fonce px-4 text-white hover:bg-vert-fonce/90 sm:flex-none">
                <Download className="size-4" /> Installer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Instructions iOS ─── */}
      <Dialog open={iosHelp} onOpenChange={setIosHelp}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl text-vert-fonce">Installer Vitalya</DialogTitle>
            <DialogDescription>Trois gestes dans Safari pour retrouver Vitalya sur votre écran d&apos;accueil.</DialogDescription>
          </DialogHeader>
          <ol className="space-y-4 text-sm">
            <li className="flex items-center gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-vert-pale font-bold text-vert-fonce">1</span>
              <span>
                Touchez <Share className="inline size-4 align-text-bottom text-[#007AFF]" aria-label="Partager" /> Partager, en bas de l&apos;écran.
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-vert-pale font-bold text-vert-fonce">2</span>
              <span>
                Choisissez <SquarePlus className="inline size-4 align-text-bottom" aria-hidden /> « Sur l&apos;écran d&apos;accueil ».
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-vert-pale font-bold text-vert-fonce">3</span>
              <span>Touchez « Ajouter » : l&apos;icône Vitalya apparaît.</span>
            </li>
          </ol>
          <Button type="button" onClick={() => setIosHelp(false)} className="mt-2 bg-vert-fonce hover:bg-vert-fonce/90">
            J&apos;ai compris
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
