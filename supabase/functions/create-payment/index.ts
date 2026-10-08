// Edge Function « create-payment » : ouvre un paiement d'abonnement Vitalya.
// Orchestration : PawaPay (Mobile Money, Afrique centrale) en premier ;
// en cas d'échec (délai dépassé, erreur 5xx, opérateur indisponible, refus),
// bascule silencieuse sur MoneyFusion. Chaque tentative est journalisée dans payment_logs.
//
// Authentification : jeton de session Supabase du lecteur (Authorization: Bearer …),
// vérifié ici (verify_jwt désactivé car les clés publiques du projet ne sont pas des JWT).
// Secrets : PAWAPAY_API_KEY, PAWAPAY_BASE_URL, MONEYFUSION_API_URL (+ variables Supabase injectées).
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const PAWAPAY_API_KEY = Deno.env.get("PAWAPAY_API_KEY") ?? ""
const PAWAPAY_BASE_URL = (Deno.env.get("PAWAPAY_BASE_URL") || "https://api.sandbox.pawapay.io").replace(/\/+$/, "")
const MONEYFUSION_API_URL = Deno.env.get("MONEYFUSION_API_URL") ?? ""

// Seuls les domaines Vitalya peuvent servir d'adresse de retour (pas de redirection ouverte)
const ALLOWED_ORIGINS = [
  "https://vitalya.africa",
  "https://www.vitalya.africa",
  "https://vitalya-mocha.vercel.app",
  "http://localhost:3000",
]

const COUNTRIES = {
  TCD: { dialCode: "235", localDigits: 8 },
  CMR: { dialCode: "237", localDigits: 9 },
} as const
type Country = keyof typeof COUNTRIES

const LABELS = { premium: "Premium", expert: "Expert" } as const
type Tier = keyof typeof LABELS

const PROVIDER_TIMEOUT_MS = 12000

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

type Input = {
  tier: Tier
  method: "mobile" | "card"
  country: Country | null
  operator: string | null
  phone: string
  name: string
  origin: string
}

function parseInput(raw: unknown): Input | null {
  if (!raw || typeof raw !== "object") return null
  const body = raw as Record<string, unknown>
  const tier = body.tier === "premium" || body.tier === "expert" ? body.tier : null
  const method = body.method === "mobile" || body.method === "card" ? body.method : null
  const country = body.country === "TCD" || body.country === "CMR" ? body.country : null
  const operator = typeof body.operator === "string" && /^[A-Z0-9_]{3,40}$/.test(body.operator) ? body.operator : null
  const phone = typeof body.phone === "string" ? body.phone.replace(/[^\d+]/g, "").slice(0, 20) : ""
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : ""
  const origin = typeof body.origin === "string" && ALLOWED_ORIGINS.includes(body.origin) ? body.origin : null
  if (!tier || !method || !origin) return null
  return { tier, method, country, operator, phone, name, origin }
}

/** Numéro au format PawaPay (indicatif + numéro, chiffres uniquement), ou null. */
function pawapayPhone(raw: string, country: Country): string | null {
  const { dialCode, localDigits } = COUNTRIES[country]
  let digits = raw.replace(/\D/g, "")
  if (digits.startsWith("00")) digits = digits.slice(2)
  if (digits.startsWith(dialCode) && digits.length === dialCode.length + localDigits) digits = digits.slice(dialCode.length)
  if (digits.length !== localDigits || digits.startsWith("0")) return null
  return `${dialCode}${digits}`
}

class ProviderError extends Error {}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) })
  } catch (error) {
    throw new ProviderError(error instanceof Error && error.name === "TimeoutError" ? "Délai dépassé" : `Réseau : ${String(error)}`)
  }
}

/** L'opérateur est-il ouvert aux dépôts selon la configuration PawaPay du compte ? */
async function pawapayOperatorAvailable(country: Country, operator: string): Promise<boolean> {
  const response = await fetchWithTimeout(`${PAWAPAY_BASE_URL}/v2/active-conf?country=${country}&operationType=DEPOSIT`, {
    headers: { Authorization: `Bearer ${PAWAPAY_API_KEY}` },
  })
  if (response.status >= 500) throw new ProviderError(`active-conf HTTP ${response.status}`)
  if (!response.ok) throw new ProviderError(`active-conf HTTP ${response.status}`)
  const conf = (await response.json()) as {
    countries?: { country: string; providers?: { provider: string; currencies?: { operationTypes?: { DEPOSIT?: { status?: string } } }[] }[] }[]
  }
  return (conf.countries ?? [])
    .filter((entry) => entry.country === country)
    .flatMap((entry) => entry.providers ?? [])
    .some(
      (provider) =>
        provider.provider === operator &&
        (provider.currencies ?? []).some((item) => item.operationTypes?.DEPOSIT && item.operationTypes.DEPOSIT.status !== "CLOSED"),
    )
}

async function openPawapay(paymentId: string, input: Input, amount: number): Promise<string> {
  if (!PAWAPAY_API_KEY) throw new ProviderError("PawaPay non configuré")
  if (!input.country || !input.operator) throw new ProviderError("Pays ou opérateur manquant")
  const phoneNumber = pawapayPhone(input.phone, input.country)
  if (!phoneNumber) throw new ProviderError("Numéro invalide pour PawaPay")
  if (!(await pawapayOperatorAvailable(input.country, input.operator))) {
    throw new ProviderError(`Opérateur indisponible : ${input.operator}`)
  }

  const response = await fetchWithTimeout(`${PAWAPAY_BASE_URL}/v2/checkouts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PAWAPAY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      checkoutId: paymentId,
      returnUrl: `${input.origin}/abonnement/confirmation?fournisseur=pawapay&paiement=${paymentId}`,
      returnMethod: "COUNTDOWN",
      defaultLanguage: "fr",
      countries: [input.country],
      expiresAfter: 30,
      amounts: [{ country: input.country, currency: "XAF", amount: String(amount) }],
      payer: { type: "MMO", accountDetails: { phoneNumber, provider: input.operator, allowCustomerToOverride: true } },
      clientReferenceId: paymentId,
      // Libellé affiché par PawaPay : 4 à 22 caractères, lettres, chiffres et espaces
      reason: { fr: `Vitalya ${LABELS[input.tier]}`, en: `Vitalya ${LABELS[input.tier]}` },
    }),
  })
  const body = (await response.json().catch(() => null)) as {
    status?: string
    redirectUrl?: string
    failureReason?: { failureCode?: string; failureMessage?: string }
  } | null
  if (response.ok && (body?.status === "ACCEPTED" || body?.status === "DUPLICATE_IGNORED") && body.redirectUrl) {
    return body.redirectUrl
  }
  throw new ProviderError(
    `HTTP ${response.status} ${body?.failureReason?.failureCode ?? body?.status ?? ""} ${body?.failureReason?.failureMessage ?? ""}`.trim(),
  )
}

async function openMoneyFusion(paymentId: string, input: Input, amount: number, userId: string): Promise<{ token: string; url: string }> {
  if (!MONEYFUSION_API_URL) throw new ProviderError("MoneyFusion non configuré")
  const label = `Abonnement Vitalya ${LABELS[input.tier]}`
  const returnUrl = `${input.origin}/abonnement/confirmation?fournisseur=moneyfusion&paiement=${paymentId}`
  const response = await fetchWithTimeout(MONEYFUSION_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Champs documentés par MoneyFusion (totalPrice, article, numeroSend, nomclient, personal_Info,
    // return_url, webhook_url) complétés des champs demandés par Vitalya (articles, nom_client, user_id, order_id).
    body: JSON.stringify({
      totalPrice: String(amount),
      article: [{ [label]: amount }],
      articles: [{ name: label, price: String(amount), quantity: 1 }],
      numeroSend: input.phone || "0000000000",
      nomclient: input.name || "Abonné Vitalya",
      nom_client: input.name || "Abonné Vitalya",
      personal_Info: [{ paymentId, userId }],
      user_id: userId,
      order_id: paymentId,
      return_url: returnUrl,
      webhook_url: `${input.origin}/api/payments/moneyfusion/webhook`,
    }),
  })
  const body = (await response.json().catch(() => null)) as { statut?: boolean; token?: string; url?: string; message?: string } | null
  if (response.ok && body?.statut !== false && body?.token && body.url?.startsWith("https://")) {
    return { token: body.token, url: body.url }
  }
  throw new ProviderError(`HTTP ${response.status} ${body?.message ?? "réponse inattendue"}`)
}

type LogEntry = {
  user_id: string
  payment_id: string | null
  amount: number
  currency: string
  provider_attempted: "pawapay" | "moneyfusion"
  provider_used: "pawapay" | "moneyfusion" | null
  status: "initiated" | "fallback" | "failed"
  error_message?: string
}

async function log(admin: SupabaseClient, entry: LogEntry) {
  const { error } = await admin.from("payment_logs").insert({ ...entry, error_message: entry.error_message?.slice(0, 1000) })
  if (error) console.error("payment_logs", error.message)
}

Deno.serve(async (req) => {
  // Diagnostic sans secret : quels prestataires sont configurés
  if (req.method === "GET") {
    return json({ pawapay: Boolean(PAWAPAY_API_KEY), moneyfusion: Boolean(MONEYFUSION_API_URL) })
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? ""
  if (!token) return json({ error: "not_authenticated" }, 401)

  // Client « lecteur » (RLS + auth.uid()) et client d'administration (journal, annulation)
  const asUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: userData, error: authError } = await asUser.auth.getUser(token)
  if (authError || !userData.user) return json({ error: "not_authenticated" }, 401)
  const userId = userData.user.id

  const input = parseInput(await req.json().catch(() => null))
  if (!input) return json({ error: "invalid_request" }, 400)

  // ─── 1. PawaPay (Mobile Money) ───
  if (input.method === "mobile") {
    const { data: payment, error } = await asUser
      .rpc("create_payment", { p_tier: input.tier, p_provider: "pawapay", p_currency: "XAF", p_country: input.country ?? "", p_operator: input.operator ?? "" })
      .single<{ payment_id: string; amount: number }>()
    if (error || !payment) {
      return json({ error: error?.message.includes("too_many_payments") ? "too_many_payments" : "payment_error" }, 400)
    }
    try {
      const redirectUrl = await openPawapay(payment.payment_id, input, payment.amount)
      await log(admin, {
        user_id: userId, payment_id: payment.payment_id, amount: payment.amount, currency: "XAF",
        provider_attempted: "pawapay", provider_used: "pawapay", status: "initiated",
      })
      return json({ provider: "pawapay", paymentId: payment.payment_id, redirectUrl })
    } catch (error) {
      // Échec PawaPay : paiement abandonné, journalisé, puis bascule sur MoneyFusion
      const message = error instanceof Error ? error.message : String(error)
      console.error("pawapay", message)
      await admin.from("subscriptions").update({ status: "failed" }).eq("id", payment.payment_id).eq("status", "incomplete")
      await log(admin, {
        user_id: userId, payment_id: payment.payment_id, amount: payment.amount, currency: "XAF",
        provider_attempted: "pawapay", provider_used: MONEYFUSION_API_URL ? "moneyfusion" : null, status: "fallback",
        error_message: message,
      })
    }
  }

  // ─── 2. MoneyFusion (carte bancaire, Wave, Mobile Money Afrique de l'Ouest) ───
  const { data: payment, error } = await asUser
    .rpc("create_payment", { p_tier: input.tier, p_provider: "moneyfusion", p_currency: "XOF", p_country: input.country ?? "", p_operator: "" })
    .single<{ payment_id: string; amount: number }>()
  if (error || !payment) {
    return json({ error: error?.message.includes("too_many_payments") ? "too_many_payments" : "payment_error" }, 400)
  }
  try {
    const { token: mfToken, url } = await openMoneyFusion(payment.payment_id, input, payment.amount, userId)
    const { error: attachError } = await admin
      .from("subscriptions")
      .update({ moneyfusion_token: mfToken })
      .eq("id", payment.payment_id)
      .eq("status", "incomplete")
    if (attachError) throw new ProviderError(`Jeton non enregistré : ${attachError.message}`)
    await log(admin, {
      user_id: userId, payment_id: payment.payment_id, amount: payment.amount, currency: "XOF",
      provider_attempted: "moneyfusion", provider_used: "moneyfusion", status: "initiated",
    })
    return json({ provider: "moneyfusion", paymentId: payment.payment_id, redirectUrl: url })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("moneyfusion", message)
    await admin.from("subscriptions").update({ status: "failed" }).eq("id", payment.payment_id).eq("status", "incomplete")
    await log(admin, {
      user_id: userId, payment_id: payment.payment_id, amount: payment.amount, currency: "XOF",
      provider_attempted: "moneyfusion", provider_used: null, status: "failed", error_message: message,
    })
    return json({ error: "providers_unavailable" }, 502)
  }
})
