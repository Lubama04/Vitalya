"use server"

import { redirect } from "next/navigation"
import { z } from "zod"
import { fail, type ActionState } from "@/actions/types"
import { getViewer } from "@/lib/auth"
import { siteUrl } from "@/lib/env"
import { features } from "@/lib/env.server"
import { createMoneyFusionPayment } from "@/lib/payments/moneyfusion"
import {
  createPawapayCheckout,
  getPawapayProviders,
  isPawapayCountry,
  normalizePhone,
  type PawapayProvider,
} from "@/lib/payments/pawapay"
import { createClient } from "@/lib/supabase/server"

const tierSchema = z.enum(["premium", "expert"], { error: "Formule invalide" })

// Repli si la configuration PawaPay est momentanément injoignable
const FALLBACK_OPERATORS: Record<"TCD" | "CMR", { code: string; name: string }[]> = {
  TCD: [
    { code: "MTN_MOMO_TCD", name: "MTN MoMo" },
    { code: "ORANGE_TCD", name: "Orange Money" },
    { code: "AIRTEL_TCD", name: "Airtel Money" },
  ],
  CMR: [
    { code: "MTN_MOMO_CMR", name: "MTN MoMo" },
    { code: "ORANGE_CMR", name: "Orange Money" },
  ],
}

/** Opérateurs Mobile Money disponibles pour un pays (configuration PawaPay en direct). */
export async function listPawapayOperators(country: unknown): Promise<PawapayProvider[]> {
  if (!features.pawapay || !isPawapayCountry(country)) return []
  const providers = await getPawapayProviders(country)
  return providers.length > 0 ? providers : FALLBACK_OPERATORS[country].map((operator) => ({ ...operator, country }))
}

/** Messages lisibles pour les erreurs de la base. */
function paymentError(message: string | undefined): string {
  if (message?.includes("too_many_payments")) return "Trop de tentatives de paiement. Réessayez dans une heure."
  if (message?.includes("not_authenticated")) return "Connectez-vous pour vous abonner."
  return "Impossible d'ouvrir le paiement. Réessayez dans un instant."
}

const pawapaySchema = z.object({
  tier: tierSchema,
  country: z.enum(["TCD", "CMR"], { error: "Choisissez votre pays" }),
  operator: z.string().regex(/^[A-Z0-9_]{3,40}$/, "Choisissez votre opérateur"),
  phone: z.string().trim().min(6, "Numéro de téléphone requis").max(30),
})

/**
 * « Choisir Premium / Expert » → Mobile Money PawaPay :
 * paiement enregistré (montant fixé en base), page PawaPay ouverte, redirection du lecteur.
 */
export async function startPawapayCheckout(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!features.pawapay) return fail("Le paiement Mobile Money n'est pas encore activé.")
  const viewer = await getViewer()
  if (!viewer) redirect("/auth?next=/abonnement")

  const parsed = pawapaySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  const { tier, country, operator, phone } = parsed.data

  const phoneNumber = normalizePhone(phone, country)
  if (!phoneNumber) {
    return fail(country === "TCD" ? "Numéro tchadien invalide (8 chiffres, ex. 66 12 34 56)." : "Numéro camerounais invalide (9 chiffres, ex. 6 71 23 45 67).")
  }

  // L'opérateur doit faire partie de ceux ouverts par PawaPay pour ce pays
  const providers = await getPawapayProviders(country)
  if (providers.length > 0 && !providers.some((provider) => provider.code === operator)) {
    return fail("Cet opérateur n'est pas disponible pour le moment.")
  }

  const supabase = await createClient()
  const { data: payment, error } = await supabase
    .rpc("create_payment", { p_tier: tier, p_provider: "pawapay", p_currency: "XAF", p_country: country, p_operator: operator })
    .single()
  if (error || !payment) return fail(paymentError(error?.message))

  const checkout = await createPawapayCheckout({
    checkoutId: payment.payment_id,
    country,
    amount: payment.amount,
    phoneNumber,
    provider: operator,
    returnUrl: `${siteUrl}/abonnement/retour?fournisseur=pawapay&paiement=${payment.payment_id}`,
  })
  if (!checkout.ok) {
    console.error("startPawapayCheckout", checkout.code, checkout.message)
    if (checkout.code === "INVALID_PHONE_NUMBER") return fail("Ce numéro ne correspond pas à l'opérateur choisi.")
    return fail("PawaPay n'a pas pu ouvrir le paiement. Réessayez dans un instant.")
  }

  redirect(checkout.redirectUrl)
}

const moneyFusionSchema = z.object({
  tier: tierSchema,
  phone: z
    .string()
    .trim()
    .transform((value) => value.replace(/[^\d+]/g, ""))
    .pipe(z.string().regex(/^\+?\d{8,15}$/, "Numéro de téléphone invalide")),
  name: z.string().trim().min(2, "Indiquez votre nom").max(80),
})

/** « Choisir Premium / Expert » → MoneyFusion (carte bancaire, Wave, Mobile Money UEMOA). */
export async function startMoneyFusionPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!features.moneyfusion) return fail("Le paiement par carte / Wave n'est pas encore activé.")
  const viewer = await getViewer()
  if (!viewer) redirect("/auth?next=/abonnement")

  const parsed = moneyFusionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  const { tier, phone, name } = parsed.data

  const supabase = await createClient()
  const { data: payment, error } = await supabase
    .rpc("create_payment", { p_tier: tier, p_provider: "moneyfusion", p_currency: "XOF", p_country: "", p_operator: "" })
    .single()
  if (error || !payment) return fail(paymentError(error?.message))

  const result = await createMoneyFusionPayment({
    paymentId: payment.payment_id,
    amount: payment.amount,
    label: `Abonnement Vitalya ${tier === "expert" ? "Expert" : "Premium"}`,
    phone,
    customerName: name,
    returnUrl: `${siteUrl}/abonnement/retour?fournisseur=moneyfusion&paiement=${payment.payment_id}`,
    webhookUrl: `${siteUrl}/api/payments/moneyfusion/webhook`,
  })
  if (!result.ok) {
    console.error("startMoneyFusionPayment", result.message)
    return fail("MoneyFusion n'a pas pu ouvrir le paiement. Réessayez dans un instant.")
  }

  const { error: attachError } = await supabase.rpc("attach_moneyfusion_token", {
    p_payment_id: payment.payment_id,
    p_token: result.token,
  })
  if (attachError) {
    console.error("attach_moneyfusion_token", attachError.message)
    return fail("Impossible d'enregistrer le paiement. Réessayez.")
  }

  redirect(result.url)
}
