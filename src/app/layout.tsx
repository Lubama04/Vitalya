import type { Metadata, Viewport } from "next"
import {
  Cormorant_Garamond,
  Inter,
  Libre_Baskerville,
  Lora,
  Merriweather,
  Playfair_Display,
  Source_Serif_4,
} from "next/font/google"
import { SiteHeader } from "@/components/layout/site-header"
import { SiteFooter } from "@/components/layout/site-footer"
import { InstallBanner } from "@/components/pwa/install-banner"
import { INSTALL_CAPTURE_SCRIPT } from "@/components/pwa/install-capture"
import { UpdateManager } from "@/components/pwa/update-manager"
import { Toaster } from "@/components/ui/sonner"
import { SITE } from "@/lib/constants"
import { siteUrl } from "@/lib/env"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-playfair",
  weight: ["400", "600", "700", "800"],
  style: ["normal", "italic"],
})

// Polices éditoriales au choix du rédacteur : non préchargées, le navigateur
// ne télécharge un fichier que si un article l'utilise réellement.
const lora = Lora({ subsets: ["latin"], display: "swap", variable: "--font-lora", preload: false, style: ["normal", "italic"] })
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-cormorant",
  preload: false,
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
})
const merriweather = Merriweather({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-merriweather",
  preload: false,
  weight: ["400", "700"],
  style: ["normal", "italic"],
})
const sourceSerif = Source_Serif_4({ subsets: ["latin"], display: "swap", variable: "--font-source-serif", preload: false, style: ["normal", "italic"] })
const baskerville = Libre_Baskerville({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-baskerville",
  preload: false,
  weight: ["400", "700"],
  style: ["normal", "italic"],
})

const fontVariables = [inter, playfair, lora, cormorant, merriweather, sourceSerif, baskerville]
  .map((font) => font.variable)
  .join(" ")

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${SITE.name} : ${SITE.slogan}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: ["santé", "beauté", "bien-être", "Afrique", "magazine", "nutrition", "beauté naturelle"],
  openGraph: {
    type: "website",
    locale: SITE.locale,
    siteName: SITE.name,
    title: `${SITE.name} : ${SITE.slogan}`,
    description: SITE.description,
  },
  twitter: { card: "summary_large_image" },
  appleWebApp: {
    capable: true,
    title: SITE.name,
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: "#0D6B4A",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={fontVariables}>
      <head>
        {/* Capture de l'invite d'installation PWA avant l'hydratation */}
        <script dangerouslySetInnerHTML={{ __html: INSTALL_CAPTURE_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:bg-vert-fonce focus:px-4 focus:py-2 focus:text-white"
        >
          Aller au contenu
        </a>
        <SiteHeader />
        <main id="contenu" className="flex-1 overflow-x-clip">
          {children}
        </main>
        <SiteFooter />
        <Toaster position="top-center" richColors />
        <InstallBanner />
        <UpdateManager />
      </body>
    </html>
  )
}
