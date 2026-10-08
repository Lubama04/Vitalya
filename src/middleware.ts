import type { NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  // Exclut les fichiers statiques, les images, le service worker et le webhook Stripe
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|opengraph-image.png|manifest.webmanifest|sw.js|workbox-.*|fallback-.*|swe-worker-.*|brand/|icons/|covers/|api/stripe/webhook|api/payments/).*)",
  ],
}
