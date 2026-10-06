import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { WifiOff } from "lucide-react"

export const metadata: Metadata = { title: "Hors connexion", robots: { index: false } }

// Page de secours servie par le service worker quand le réseau est indisponible
export default function OfflinePage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
      <Image src="/brand/emblem.webp" alt="" width={88} height={88} className="mb-6 size-22" />
      <WifiOff className="mb-4 size-8 text-orange" aria-hidden />
      <h1 className="text-3xl font-bold text-vert-fonce">Vous êtes hors connexion</h1>
      <p className="mt-3 text-muted-foreground">
        Pas d&apos;inquiétude : les articles que vous avez déjà consultés restent disponibles. Reconnectez-vous
        pour découvrir les nouveautés.
      </p>
      <Link href="/" className="mt-8 rounded-md bg-vert-fonce px-5 py-2.5 text-sm font-medium text-white">
        Réessayer
      </Link>
      <p className="mt-10 font-heading text-sm italic text-muted-foreground">Vivre mieux, naturellement.</p>
    </div>
  )
}
