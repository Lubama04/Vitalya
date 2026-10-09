"use server"

import { redirect } from "next/navigation"
import { z } from "zod"
import { fail, type ActionState } from "@/actions/types"
import { siteUrl } from "@/lib/env"
import { isCountryCode, mobileMoneyCountry } from "@/lib/payments/countries"
import { createPaymentViaEdge } from "@/lib/payments/edge"
import { getPawapayProviders, type PawapayProvider } from "@/lib/payments/pawapay"
import { createClient } from "@/lib/supabase/server"

/**
 * Opérateurs Mobile Money proposés pour un pays (configuration du prestataire principal, en direct).
 * Liste vide : le lecteur choisira son opérateur sur la page de paiement.
 */
export async function listMobileOperators(country: unknown): Promise<PawapayProvider[]> {
  const info = typeof country === "string" ? mobileMoneyCountry(country) : null
  if (!info || info.route === "moneyfusion") return []
  return getPawapayProviders(info)
}

const paymentSchema = z.object({
  tier: z.enum(["premium", "expert"], { error: "Formule invalide" }),
  method: z.enum(["mobile", "card"]),
  country: z.string().refine(isCountryCode, "Choisissez votre pays."),
  operator: z
    .string()
    .regex(/^[A-Z0-9_]{3,40}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  phone: z.string().trim().max(30).optional().default(""),
})

/**
 * « Payer par Mobile Money » / « Payer par Visa / Mastercard ».
 * Le routage entre prestataires (et la bascule automatique) est fait par l'Edge Function
 * create-payment ; le lecteur est redirigé vers la page de paiement retenue.
 */
export async function startPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth?next=/abonnement")
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) redirect("/auth?next=/abonnement")

  const parsed = paymentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  const data = parsed.data

  if (data.method === "mobile") {
    if (!mobileMoneyCountry(data.country)) return fail("Le Mobile Money n'est pas disponible dans ce pays : utilisez Visa / Mastercard.")
    if (data.phone.replace(/\D/g, "").length < 7) return fail("Indiquez votre numéro Mobile Money.")
  }

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()

  const result = await createPaymentViaEdge(session.access_token, {
    tier: data.tier,
    method: data.method,
    country: data.country,
    operator: data.operator ?? null,
    phone: data.phone,
    name: profile?.full_name || "",
    origin: siteUrl,
  })

  if (!result.ok) {
    if (result.error === "not_authenticated") redirect("/auth?next=/abonnement")
    if (result.error === "too_many_payments") return fail("Trop de tentatives de paiement. Réessayez dans une heure.")
    return fail(
      data.method === "mobile"
        ? "Le paiement Mobile Money est momentanément indisponible. Réessayez dans quelques minutes ou payez par Visa / Mastercard."
        : "Le paiement par carte est momentanément indisponible. Réessayez dans quelques minutes.",
    )
  }

  redirect(result.redirectUrl)
}
