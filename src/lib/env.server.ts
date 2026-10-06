import "server-only"
import { z } from "zod"

// Variables serveur : jamais exposées au navigateur (pas de préfixe NEXT_PUBLIC_).
// Toutes optionnelles : chaque fonctionnalité vérifie sa propre configuration
// et se désactive proprement si elle est absente (Stripe, Resend, push…).
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  RESEND_API_KEY: z.string().startsWith("re_").optional(),
  RESEND_FROM_EMAIL: z.string().min(3).default("Vitalya <onboarding@resend.dev>"),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  STRIPE_PRICE_PREMIUM: z.string().startsWith("price_").optional(),
  STRIPE_PRICE_EXPERT: z.string().startsWith("price_").optional(),
})

// Les chaînes vides sont traitées comme absentes
const raw = Object.fromEntries(
  Object.keys(serverSchema.shape).map((key) => [key, process.env[key] || undefined]),
)

export const serverEnv = serverSchema.parse(raw)

export const features = {
  email: Boolean(serverEnv.RESEND_API_KEY),
  stripe: Boolean(
    serverEnv.STRIPE_SECRET_KEY &&
      serverEnv.STRIPE_WEBHOOK_SECRET &&
      serverEnv.STRIPE_PRICE_PREMIUM &&
      serverEnv.STRIPE_PRICE_EXPERT &&
      serverEnv.SUPABASE_SERVICE_ROLE_KEY,
  ),
} as const
