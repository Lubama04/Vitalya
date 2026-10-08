"use server"

import { redirect } from "next/navigation"
import { z } from "zod"
import { getViewer } from "@/lib/auth"
import { siteUrl } from "@/lib/env"
import { getStripe, priceIdFor } from "@/lib/stripe"
import { createClient } from "@/lib/supabase/server"
import { fail, type ActionState } from "@/actions/types"

const tierSchema = z.enum(["premium", "expert"])

/** Démarre un paiement Stripe Checkout pour l'offre choisie. */
export async function startCheckout(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = tierSchema.safeParse(formData.get("tier"))
  if (!parsed.success) return fail("Offre invalide.")

  const viewer = await getViewer()
  if (!viewer) redirect(`/auth?next=${encodeURIComponent("/abonnement")}`)

  const stripe = getStripe()
  const price = priceIdFor(parsed.data)
  if (!stripe || !price) {
    return fail("Le paiement en ligne arrive très bientôt. Merci de votre patience !")
  }

  // Réutilise le client Stripe existant s'il y en a un
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", viewer.id)
    .not("stripe_customer_id", "is", null)
    .limit(1)
    .maybeSingle()

  let url: string | null = null
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: viewer.id,
      ...(existing?.stripe_customer_id
        ? { customer: existing.stripe_customer_id }
        : { customer_email: viewer.email }),
      metadata: { user_id: viewer.id, tier: parsed.data },
      subscription_data: { metadata: { user_id: viewer.id, tier: parsed.data } },
      locale: "fr",
      allow_promotion_codes: true,
      success_url: `${siteUrl}/profil?abonnement=succes`,
      cancel_url: `${siteUrl}/abonnement?abonnement=annule`,
    })
    url = session.url
  } catch (error) {
    console.error("startCheckout", error instanceof Error ? error.message : error)
    return fail("Le paiement n'a pas pu être initialisé. Réessayez plus tard.")
  }

  if (!url) return fail("Le paiement n'a pas pu être initialisé.")
  redirect(url)
}

/** Ouvre le portail client Stripe (gestion / résiliation de l'abonnement). */
export async function openBillingPortal(): Promise<void> {
  const viewer = await getViewer()
  if (!viewer) redirect("/auth?next=/profil")

  const stripe = getStripe()
  if (!stripe) redirect("/profil")

  const supabase = await createClient()
  const { data } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", viewer.id)
    .not("stripe_customer_id", "is", null)
    .limit(1)
    .maybeSingle()
  if (!data?.stripe_customer_id) redirect("/abonnement")

  const portal = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${siteUrl}/profil`,
  })
  redirect(portal.url)
}
