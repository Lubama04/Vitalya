"use server"

import { redirect } from "next/navigation"
import { z } from "zod"
import { fail, type ActionState } from "@/actions/types"
import { siteUrl } from "@/lib/env"
import { serverEnv } from "@/lib/env.server"
import { createPaymentViaEdge } from "@/lib/payments/edge"
import { getPawapayProviders, isPawapayCountry, type PawapayProvider } from "@/lib/payments/pawapay"
import { createClient } from "@/lib/supabase/server"

// Repli si la configuration PawaPay est momentanément injoignable
const FALLBACK_OPERATORS: Record<"TCD" | "CMR", { code: string; name: string }[]> = {
  TCD: [
    { code: "AIRTEL_TCD", name: "Airtel Money" },
    { code: "MOOV_TCD", name: "Moov Money" },
  ],
  CMR: [
    { code: "MTN_MOMO_CMR", name: "MTN MoMo" },
    { code: "ORANGE_CMR", name: "Orange Money" },
  ],
}

/** Opérateurs Mobile Money ouverts pour un pays (lus en direct via /v2/active-conf, jamais figés). */
export async function listPawapayOperators(country: unknown): Promise<PawapayProvider[]> {
  if (!isPawapayCountry(country)) return []
  const providers = serverEnv.PAWAPAY_API_KEY ? await getPawapayProviders(country) : []
  return providers.length > 0 ? providers : FALLBACK_OPERATORS[country].map((operator) => ({ ...operator, country }))
}

const paymentSchema = z.object({
  tier: z.enum(["premium", "expert"], { error: "Formule invalide" }),
  method: z.enum(["mobile", "card"]),
  country: z.enum(["TCD", "CMR"]).optional(),
  operator: z
    .string()
    .regex(/^[A-Z0-9_]{3,40}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  phone: z.string().trim().max(30).optional().default(""),
  name: z.string().trim().max(80).optional().default(""),
})

/**
 * « Payer par Mobile Money » / « Payer par carte bancaire ».
 * L'Edge Function create-payment tente PawaPay puis bascule silencieusement sur MoneyFusion ;
 * le lecteur est redirigé vers la page de paiement retenue.
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
    if (!data.country) return fail("Choisissez votre pays.")
    if (!data.operator) return fail("Choisissez votre opérateur.")
    if (data.phone.replace(/\D/g, "").length < 8) return fail("Indiquez votre numéro Mobile Money.")
  }

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()

  const result = await createPaymentViaEdge(session.access_token, {
    tier: data.tier,
    method: data.method,
    country: data.country ?? null,
    operator: data.operator ?? null,
    phone: data.phone,
    name: data.name || profile?.full_name || "",
    origin: siteUrl,
  })

  if (!result.ok) {
    if (result.error === "not_authenticated") redirect("/auth?next=/abonnement")
    if (result.error === "too_many_payments") return fail("Trop de tentatives de paiement. Réessayez dans une heure.")
    return fail("Le paiement est momentanément indisponible. Réessayez dans quelques minutes.")
  }

  redirect(result.redirectUrl)
}
