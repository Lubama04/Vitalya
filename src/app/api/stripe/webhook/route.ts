import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { serverEnv } from "@/lib/env.server"
import { getStripe, tierForPrice } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/server"

// Webhook Stripe : seule source de vérité pour les abonnements payants.
// Signature vérifiée ; écritures via service role (les clients n'ont aucun droit d'écriture).

const ACTIVE_STATUSES = new Set<Stripe.Subscription.Status>(["active", "trialing"])
const KNOWN_STATUSES = new Set(["incomplete", "trialing", "active", "past_due", "canceled", "unpaid"])

async function syncSubscription(subscription: Stripe.Subscription, fallbackUserId?: string) {
  const supabase = createAdminClient()
  const item = subscription.items.data[0]
  const tier = tierForPrice(item?.price.id)
  const userId = subscription.metadata.user_id || fallbackUserId
  if (!tier || !userId) throw new Error(`Abonnement ${subscription.id} : offre ou utilisateur inconnu`)

  const status = KNOWN_STATUSES.has(subscription.status) ? subscription.status : "incomplete"
  const periodEnd = item?.current_period_end

  const { error: upsertError } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      tier,
      status,
      stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      stripe_subscription_id: subscription.id,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    },
    { onConflict: "stripe_subscription_id" },
  )
  if (upsertError) throw upsertError

  // Niveau d'accès du profil = meilleur abonnement actif
  const { data: actives } = await supabase
    .from("subscriptions")
    .select("tier")
    .eq("user_id", userId)
    .in("status", [...ACTIVE_STATUSES])
  const best = actives?.some((row) => row.tier === "expert")
    ? "expert"
    : actives?.some((row) => row.tier === "premium")
      ? "premium"
      : "free"

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ subscription_tier: best })
    .eq("id", userId)
  if (profileError) throw profileError
}

export async function POST(request: Request) {
  const stripe = getStripe()
  if (!stripe || !serverEnv.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe non configuré" }, { status: 503 })
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) return NextResponse.json({ error: "Signature manquante" }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, serverEnv.STRIPE_WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object
        if (session.mode === "subscription" && typeof session.subscription === "string") {
          const subscription = await stripe.subscriptions.retrieve(session.subscription)
          await syncSubscription(subscription, session.client_reference_id ?? undefined)
        }
        break
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object)
        break
      default:
        break
    }
  } catch (error) {
    console.error(`Webhook ${event.type}`, error instanceof Error ? error.message : error)
    // 500 : Stripe réessaiera (traitement idempotent grâce à l'upsert)
    return NextResponse.json({ error: "Traitement échoué" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
