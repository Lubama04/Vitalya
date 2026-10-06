import type { NextConfig } from "next"
import withPWAInit from "@ducanh2912/next-pwa"

const isDev = process.env.NODE_ENV !== "production"
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : ""

// Content Security Policy : sources limitées au site et au projet Supabase.
// 'unsafe-inline' reste nécessaire pour les scripts d'hydratation Next.js
// (pas de nonce afin de conserver le cache statique des pages).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${supabaseHost ? ` https://${supabaseHost}` : ""}`,
  "font-src 'self' data:",
  `connect-src 'self'${supabaseHost ? ` https://${supabaseHost} wss://${supabaseHost}` : ""}`,
  `media-src 'self' blob:${supabaseHost ? ` https://${supabaseHost}` : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src 'self' https://www.youtube-nocookie.com https://js.stripe.com https://checkout.stripe.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
]

const withPWA = withPWAInit({
  dest: "public",
  disable: isDev,
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  // Page affichée hors connexion quand une page n'est pas en cache
  fallbacks: { document: "/hors-ligne" },
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    disableDevLogs: true,
    // Règles prioritaires : pages privées et API jamais mises en cache
    runtimeCaching: [
      {
        urlPattern: /\/(admin|profil|auth|api)(\/|$|\?)/,
        handler: "NetworkOnly",
        options: { cacheName: "vitalya-private" },
      },
      {
        urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/(rest|auth|realtime|functions)\//,
        handler: "NetworkOnly",
        options: { cacheName: "vitalya-supabase-api" },
      },
    ],
  },
})

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        // Le service worker doit toujours être revalidé
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ]
  },
}

export default withPWA(nextConfig)
