import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/env"

// Les espaces privés et techniques ne sont pas indexés
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/profil", "/auth", "/api/", "/newsletter/", "/hors-ligne", "/abonnement/retour", "/abonnement/confirmation", "/abonnement/erreur", "/*?highlight="],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
