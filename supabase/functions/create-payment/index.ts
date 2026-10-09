// Edge Function « create-payment » : ouvre un paiement d'abonnement Vitalya.
//
// Routage :
// - « Visa / Mastercard » : toujours MoneyFusion, quel que soit le pays.
// - « Mobile Money » selon le pays :
//     pawapay     → PawaPay uniquement (devise locale)
//     moneyfusion → MoneyFusion uniquement
//     both        → PawaPay d'abord ; en cas d'échec (délai dépassé, erreur 5xx, opérateur
//                   indisponible, refus), bascule silencieuse sur MoneyFusion.
// Les montants viennent de la base (table subscription_prices via create_payment), jamais du navigateur.
// Chaque tentative est journalisée dans payment_logs.
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
const ALLOWED_ORIGINS = ["https://vitalya.africa", "https://www.vitalya.africa", "http://localhost:3000"]

type Route = "pawapay" | "moneyfusion" | "both"
type MobileCountry = { alpha3: string; dialCode: string; currency: string; route: Route }

// Pays Mobile Money (doit rester aligné sur src/lib/payments/countries.ts)
const MOBILE: Record<string, MobileCountry> = {
  BJ: { alpha3: "BEN", dialCode: "229", currency: "XOF", route: "both" },
  BF: { alpha3: "BFA", dialCode: "226", currency: "XOF", route: "both" },
  CM: { alpha3: "CMR", dialCode: "237", currency: "XAF", route: "both" },
  CF: { alpha3: "CAF", dialCode: "236", currency: "XAF", route: "moneyfusion" },
  CI: { alpha3: "CIV", dialCode: "225", currency: "XOF", route: "both" },
  CD: { alpha3: "COD", dialCode: "243", currency: "CDF", route: "pawapay" },
  CG: { alpha3: "COG", dialCode: "242", currency: "XAF", route: "moneyfusion" },
  GA: { alpha3: "GAB", dialCode: "241", currency: "XAF", route: "both" },
  GH: { alpha3: "GHA", dialCode: "233", currency: "GHS", route: "pawapay" },
  GW: { alpha3: "GNB", dialCode: "245", currency: "XOF", route: "moneyfusion" },
  GN: { alpha3: "GIN", dialCode: "224", currency: "GNF", route: "moneyfusion" },
  KE: { alpha3: "KEN", dialCode: "254", currency: "KES", route: "pawapay" },
  MW: { alpha3: "MWI", dialCode: "265", currency: "MWK", route: "pawapay" },
  MZ: { alpha3: "MOZ", dialCode: "258", currency: "MZN", route: "pawapay" },
  NE: { alpha3: "NER", dialCode: "227", currency: "XOF", route: "moneyfusion" },
  NG: { alpha3: "NGA", dialCode: "234", currency: "NGN", route: "pawapay" },
  RW: { alpha3: "RWA", dialCode: "250", currency: "RWF", route: "pawapay" },
  SN: { alpha3: "SEN", dialCode: "221", currency: "XOF", route: "both" },
  SL: { alpha3: "SLE", dialCode: "232", currency: "SLE", route: "pawapay" },
  TD: { alpha3: "TCD", dialCode: "235", currency: "XAF", route: "moneyfusion" },
  TZ: { alpha3: "TZA", dialCode: "255", currency: "TZS", route: "pawapay" },
  TG: { alpha3: "TGO", dialCode: "228", currency: "XOF", route: "moneyfusion" },
  UG: { alpha3: "UGA", dialCode: "256", currency: "UGX", route: "pawapay" },
  ZM: { alpha3: "ZMB", dialCode: "260", currency: "ZMW", route: "pawapay" },
}
// Pays où le zéro initial fait partie du numéro national (ne pas le retirer)
const KEEP_LEADING_ZERO = new Set(["CI", "BJ"])

// MoneyFusion encaisse en francs CFA
const MONEYFUSION_CURRENCY = "XOF"

const LABELS = { premium: "Premium", expert: "Expert" } as const
type Tier = keyof typeof LABELS

const PROVIDER_TIMEOUT_MS = 12000

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

type Input = {
  tier: Tier
  method: "mobile" | "card"
  country: string
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
  const country = typeof body.country === "string" && /^[A-Z]{2}$/.test(body.country) ? body.country : null
  const operator = typeof body.operator === "string" && /^[A-Z0-9_]{3,40}$/.test(body.operator) ? body.operator : null
  const phone = typeof body.phone === "string" ? body.phone.replace(/[^\d+]/g, "").slice(0, 20) : ""
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : ""
  const origin = typeof body.origin === "string" && ALLOWED_ORIGINS.includes(body.origin) ? body.origin : null
  if (!tier || !method || !country || !origin) return null
  return { tier, method, country, operator, phone, name, origin }
}

/** Numéro national (sans indicatif), ou chaîne vide si inexploitable. */
function nationalNumber(raw: string, country: string, dialCode: string): string {
  let digits = raw.replace(/\D/g, "")
  if (digits.startsWith("00")) digits = digits.slice(2)
  if (digits.startsWith(dialCode) && digits.length >= dialCode.length + 7) digits = digits.slice(dialCode.length)
  if (digits.startsWith("0") && !KEEP_LEADING_ZERO.has(country)) digits = digits.slice(1)
  return digits.length >= 7 && digits.length <= 11 ? digits : ""
}

class ProviderError extends Error {}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) })
  } catch (error) {
    throw new ProviderError(error instanceof Error && error.name === "TimeoutError" ? "Délai dépassé" : `Réseau : ${String(error)}`)
  }
}

/** Adresse IP publique de sortie de cette fonction (à autoriser chez MoneyFusion). */
async function egressIp(): Promise<string> {
  try {
    const response = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(4000) })
    const body = (await response.json()) as { ip?: string }
    return body.ip ?? "inconnue"
  } catch {
    return "inconnue"
  }
}

/** Opérateurs PawaPay ouverts aux dépôts pour un pays et une devise. */
async function pawapayOperators(info: MobileCountry): Promise<string[]> {
  const response = await fetchWithTimeout(`${PAWAPAY_BASE_URL}/v2/active-conf?country=${info.alpha3}&operationType=DEPOSIT`, {
    headers: { Authorization: `Bearer ${PAWAPAY_API_KEY}` },
  })
  if (!response.ok) throw new ProviderError(`active-conf HTTP ${response.status}`)
  const conf = (await response.json()) as {
    countries?: {
      country: string
      providers?: { provider: string; currencies?: { currency: string; operationTypes?: { DEPOSIT?: { status?: string } } }[] }[]
    }[]
  }
  return (conf.countries ?? [])
    .filter((entry) => entry.country === info.alpha3)
    .flatMap((entry) => entry.providers ?? [])
    .filter((provider) =>
      (provider.currencies ?? []).some(
        (item) => item.currency === info.currency && item.operationTypes?.DEPOSIT && item.operationTypes.DEPOSIT.status !== "CLOSED",
      ),
    )
    .map((provider) => provider.provider)
}

async function openPawapay(paymentId: string, input: Input, info: MobileCountry, amount: number): Promise<string> {
  if (!PAWAPAY_API_KEY) throw new ProviderError("PawaPay non configuré")

  const open = await pawapayOperators(info)
  if (open.length === 0) throw new ProviderError(`Aucun opérateur ouvert (${info.alpha3})`)
  let provider: string | null = input.operator
  if (provider && !open.includes(provider)) {
    // Opérateur fermé : bascule si possible, sinon choix laissé au lecteur sur la page de paiement
    if (info.route === "both") throw new ProviderError(`Opérateur indisponible : ${provider}`)
    provider = null
  }
  const national = nationalNumber(input.phone, input.country, info.dialCode)
  const accountDetails: Record<string, unknown> = { allowCustomerToOverride: true }
  if (national) accountDetails.phoneNumber = `${info.dialCode}${national}`
  if (provider) accountDetails.provider = provider

  const response = await fetchWithTimeout(`${PAWAPAY_BASE_URL}/v2/checkouts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PAWAPAY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      checkoutId: paymentId,
      returnUrl: `${input.origin}/abonnement/confirmation?fournisseur=pawapay&paiement=${paymentId}`,
      returnMethod: "COUNTDOWN",
      defaultLanguage: "fr",
      countries: [info.alpha3],
      expiresAfter: 30,
      amounts: [{ country: info.alpha3, currency: info.currency, amount: String(amount) }],
      ...(national || provider ? { payer: { type: "MMO", accountDetails } } : {}),
      clientReferenceId: paymentId,
      // Libellé affiché : 4 à 22 caractères, lettres, chiffres et espaces
      reason: { fr: `Vitalya ${LABELS[input.tier]}`, en: `Vitalya ${LABELS[input.tier]}` },
    }),
  })
  if (response.status >= 500) throw new ProviderError(`HTTP ${response.status}`)
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
  const info = MOBILE[input.country]
  const phone = info ? nationalNumber(input.phone, input.country, info.dialCode) : input.phone.replace(/\D/g, "")
  let response: Response
  try {
    response = await fetchWithTimeout(MONEYFUSION_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Champs documentés par MoneyFusion (totalPrice, article, numeroSend, nomclient, personal_Info,
      // return_url, webhook_url) complétés des champs demandés par Vitalya (articles, nom_client, user_id, order_id).
      body: JSON.stringify({
        totalPrice: amount,
        article: [{ [label]: amount }],
        articles: [{ name: label, price: String(amount), quantity: 1 }],
        numeroSend: phone || "0000000000",
        nomclient: input.name || "Abonné Vitalya",
        nom_client: input.name || "Abonné Vitalya",
        personal_Info: [{ paymentId, userId }],
        user_id: userId,
        order_id: paymentId,
        return_url: `${input.origin}/abonnement/confirmation?fournisseur=moneyfusion&paiement=${paymentId}`,
        webhook_url: `${input.origin}/api/payments/moneyfusion/webhook`,
      }),
    })
  } catch (error) {
    // Connexion refusée ou sans réponse : cas typique d'une adresse IP non autorisée chez MoneyFusion
    const ip = await egressIp()
    const message = error instanceof Error ? error.message : String(error)
    console.error(`IP non autorisée ${ip}`, `(MoneyFusion : ${message})`)
    throw new ProviderError(`${message} — IP de sortie ${ip}`)
  }
  const text = await response.text()
  let body: { statut?: boolean; token?: string; url?: string; message?: string } | null = null
  try {
    body = JSON.parse(text)
  } catch {
    body = null
  }
  if (response.ok && body?.statut !== false && body?.token && body.url?.startsWith("https://")) {
    return { token: body.token, url: body.url }
  }
  const ip = await egressIp()
  const detail = body?.message ?? text.slice(0, 300)
  if (response.status === 401 || response.status === 403 || /ip/i.test(detail)) console.error(`IP non autorisée ${ip}`, `(MoneyFusion HTTP ${response.status} : ${detail})`)
  else console.error("MoneyFusion", `HTTP ${response.status}`, detail, `IP de sortie ${ip}`)
  throw new ProviderError(`HTTP ${response.status} ${detail} — IP de sortie ${ip}`)
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

type Payment = { payment_id: string; amount: number }

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

  const info = MOBILE[input.country] ?? null
  if (input.method === "mobile" && !info) return json({ error: "mobile_unavailable" }, 400)

  const openPayment = async (provider: "pawapay" | "moneyfusion", currency: string) => {
    const { data, error } = await asUser
      .rpc("create_payment", {
        p_tier: input.tier,
        p_provider: provider,
        p_currency: currency,
        p_country: info?.alpha3 ?? "",
        p_operator: provider === "pawapay" ? (input.operator ?? "") : "",
      })
      .single<Payment>()
    if (error || !data) {
      return { error: json({ error: error?.message.includes("too_many_payments") ? "too_many_payments" : "payment_error" }, 400) }
    }
    return { payment: data }
  }

  // ─── 1. PawaPay (Mobile Money, pays « pawapay » ou « both ») ───
  if (input.method === "mobile" && info && info.route !== "moneyfusion") {
    const opened = await openPayment("pawapay", info.currency)
    if (opened.error) return opened.error
    const payment = opened.payment
    try {
      const redirectUrl = await openPawapay(payment.payment_id, input, info, payment.amount)
      await log(admin, {
        user_id: userId, payment_id: payment.payment_id, amount: payment.amount, currency: info.currency,
        provider_attempted: "pawapay", provider_used: "pawapay", status: "initiated",
      })
      return json({ provider: "pawapay", paymentId: payment.payment_id, redirectUrl })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error("pawapay", input.country, message)
      await admin.from("subscriptions").update({ status: "failed" }).eq("id", payment.payment_id).eq("status", "incomplete")
      const fallback = info.route === "both" && Boolean(MONEYFUSION_API_URL)
      await log(admin, {
        user_id: userId, payment_id: payment.payment_id, amount: payment.amount, currency: info.currency,
        provider_attempted: "pawapay", provider_used: fallback ? "moneyfusion" : null, status: fallback ? "fallback" : "failed",
        error_message: message,
      })
      // Pays couvert par PawaPay seul : pas de secours Mobile Money
      if (!fallback) return json({ error: "providers_unavailable" }, 502)
    }
  }

  // ─── 2. MoneyFusion (carte Visa / Mastercard partout ; Mobile Money « moneyfusion » ; secours « both ») ───
  const opened = await openPayment("moneyfusion", MONEYFUSION_CURRENCY)
  if (opened.error) return opened.error
  const payment = opened.payment
  try {
    const { token: mfToken, url } = await openMoneyFusion(payment.payment_id, input, payment.amount, userId)
    const { error: attachError } = await admin
      .from("subscriptions")
      .update({ moneyfusion_token: mfToken })
      .eq("id", payment.payment_id)
      .eq("status", "incomplete")
    if (attachError) throw new ProviderError(`Jeton non enregistré : ${attachError.message}`)
    await log(admin, {
      user_id: userId, payment_id: payment.payment_id, amount: payment.amount, currency: MONEYFUSION_CURRENCY,
      provider_attempted: "moneyfusion", provider_used: "moneyfusion", status: "initiated",
    })
    return json({ provider: "moneyfusion", paymentId: payment.payment_id, redirectUrl: url })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await admin.from("subscriptions").update({ status: "failed" }).eq("id", payment.payment_id).eq("status", "incomplete")
    await log(admin, {
      user_id: userId, payment_id: payment.payment_id, amount: payment.amount, currency: MONEYFUSION_CURRENCY,
      provider_attempted: "moneyfusion", provider_used: null, status: "failed", error_message: message,
    })
    return json({ error: "providers_unavailable" }, 502)
  }
})
