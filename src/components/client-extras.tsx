"use client"

import dynamic from "next/dynamic"

// Composants non critiques chargés après l'affichage (hors du JavaScript initial) :
// bannières d'installation / mise à jour PWA et notifications.
const InstallBanner = dynamic(() => import("@/components/pwa/install-banner").then((mod) => mod.InstallBanner), { ssr: false })
const UpdateManager = dynamic(() => import("@/components/pwa/update-manager").then((mod) => mod.UpdateManager), { ssr: false })
const Toaster = dynamic(() => import("@/components/ui/sonner").then((mod) => mod.Toaster), { ssr: false })

export function ClientExtras() {
  return (
    <>
      <Toaster position="top-center" richColors />
      <InstallBanner />
      <UpdateManager />
    </>
  )
}
