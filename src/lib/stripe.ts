import "server-only"
import Stripe from "stripe"
import { features, serverEnv } from "@/lib/env.server"

// Intégration Stripe préparée : inactive tant que les variables
// STRIPE_* et SUPABASE_SERVICE_ROLE_KEY ne sont pas renseignées.

let stripe: Stripe | null = null

export function getStripe(): Stripe | null {
  if (!features.stripe || !serverEnv.STRIPE_SECRET_KEY) return null
  stripe ??= new Stripe(serverEnv.STRIPE_SECRET_KEY, { typescript: true })
  return stripe
}

export type PaidTier = "premium" | "expert"

export function priceIdFor(tier: PaidTier): string | undefined {
  return tier === "premium" ? serverEnv.STRIPE_PRICE_PREMIUM : serverEnv.STRIPE_PRICE_EXPERT
}

export function tierForPrice(priceId: string | undefined): PaidTier | null {
  if (!priceId) return null
  if (priceId === serverEnv.STRIPE_PRICE_PREMIUM) return "premium"
  if (priceId === serverEnv.STRIPE_PRICE_EXPERT) return "expert"
  return null
}
