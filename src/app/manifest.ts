import type { MetadataRoute } from "next"
import { SITE } from "@/lib/constants"

// Manifeste PWA (servi sur /manifest.webmanifest)
export default function manifest(): MetadataRoute.Manifest {
  const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

  return {
    id: "/",
    name: `${SITE.name} — ${SITE.tagline}`,
    short_name: SITE.name,
    description: SITE.description,
    lang: "fr",
    dir: "ltr",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    orientation: "portrait-primary",
    background_color: "#FFFFFF",
    theme_color: "#0D6B4A",
    categories: ["health", "lifestyle", "magazines", "news"],
    icons: [
      ...sizes.map((size) => ({
        src: `/icons/icon-${size}.png`,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose: "any" as const,
      })),
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Derniers articles",
        short_name: "Articles",
        url: "/articles",
        icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }],
      },
      {
        name: "Mon espace",
        short_name: "Profil",
        url: "/profil",
        icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }],
      },
    ],
    screenshots: [
      {
        src: "/covers/volume-01.webp",
        sizes: "900x1273",
        type: "image/webp",
        form_factor: "narrow",
        label: "Vitalya — Volume 01",
      },
    ],
  }
}
