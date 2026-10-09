// Edge Function « confirm-payment » : vérifie l'état d'un paiement AUPRÈS DU PRESTATAIRE
// puis active l'abonnement (fonction SQL confirm_payment : idempotente, montant contrôlé,
// prolongation d'un mois à la suite d'une période en cours).
//
// Appelée uniquement par le serveur Vitalya (webhooks, page de confirmation) avec l'en-tête
// x-payment-secret, comparé à l'empreinte SHA-256 stockée dans public.app_secrets.
// Le contenu des notifications des prestataires n'est jamais cru sur parole.
//
// Diagnostic (même secret) : { "diagnostic": "moneyfusion" } teste l'API MoneyFusion et
// journalise « IP non autorisée x.x.x.x » si l'adresse de sortie est bloquée.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const PAWAPAY_API_KEY = Deno.env.get("PAWAPAY_API_KEY") ?? ""
const PAWAPAY_BASE_URL = (Deno.env.get("PAWAPAY_BASE_URL") || "https://api.sandbox.pawapay.io").replace(/\/+$/, "")
const MONEYFUSION_API_URL = Deno.env.get("MONEYFUSION_API_URL") ?? ""
const MONEYFUSION_STATUS_URL = "https://pay.moneyfusion.net/paiementNotif"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MF_TOKEN = /^[A-Za-z0-9_-]{6,200}$/

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function egressIp(): Promise<string> {
  try {
    const response = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(4000) })
    return ((await response.json()) as { ip?: string }).ip ?? "inconnue"
  } catch {
    return "inconnue"
  }
}

type Verified = { status: "paid" | "failed" | "pending" | "unknown"; paidAmount: number | null; currency: string | null } | null

async function verifyPawapay(checkoutId: string): Promise<Verified> {
  const response = await fetch(`${PAWAPAY_BASE_URL}/v2/checkouts/${encodeURIComponent(checkoutId)}`, {
    headers: { Authorization: `Bearer ${PAWAPAY_API_KEY}` },
    signal: AbortSignal.timeout(12000),
  })
  if (response.status === 404) return { status: "unknown", paidAmount: null, currency: null }
  if (!response.ok) return null
  const body = (await response.json()) as {
    status?: string
    data?: { status?: string; deposit?: { status?: string; amount?: string; currency?: string } }
  }
  if (body.status === "NOT_FOUND") return { status: "unknown", paidAmount: null, currency: null }
  if (body.status !== "FOUND" || !body.data) return null
  const state = body.data.status
  if (state === "COMPLETED") {
    const deposit = body.data.deposit
    const amount = deposit?.status === "COMPLETED" ? Math.floor(Number(deposit.amount)) : NaN
    return { status: "paid", paidAmount: Number.isFinite(amount) ? amount : null, currency: deposit?.currency ?? null }
  }
  if (state === "FAILED" || state === "EXPIRED" || state === "CANCELLED") return { status: "failed", paidAmount: null, currency: null }
  return { status: "pending", paidAmount: null, currency: null }
}

async function verifyMoneyFusion(token: string): Promise<Verified> {
  const response = await fetch(`${MONEYFUSION_STATUS_URL}/${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(12000) })
  if (response.status === 404) return { status: "unknown", paidAmount: null, currency: null }
  if (!response.ok) return null
  const body = (await response.json()) as { statut?: boolean; data?: { statut?: string; Montant?: number | string } }
  // Jeton inconnu : MoneyFusion répond { statut: false, message: "paiement introuvable" }
  if (body.statut === false) return { status: "unknown", paidAmount: null, currency: null }
  if (!body.data) return null
  const state = body.data.statut
  if (state === "paid") {
    const amount = Math.floor(Number(body.data.Montant))
    // MoneyFusion encaisse en francs CFA
    return { status: "paid", paidAmount: Number.isFinite(amount) ? amount : null, currency: "XOF" }
  }
  if (state === "failure" || state === "failed" || state === "no paid") return { status: "failed", paidAmount: null, currency: null }
  return { status: "pending", paidAmount: null, currency: null }
}

/** Test de l'API MoneyFusion depuis cette fonction (adresse IP de sortie incluse). */
async function diagnoseMoneyFusion() {
  const ip = await egressIp()
  if (!MONEYFUSION_API_URL) return { configured: false, ip }
  const started = Date.now()
  try {
    const response = await fetch(MONEYFUSION_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        totalPrice: 6000,
        article: [{ "Diagnostic Vitalya": 6000 }],
        numeroSend: "0700000000",
        nomclient: "Diagnostic Vitalya",
        personal_Info: [{ diagnostic: true }],
        return_url: "https://vitalya.africa/abonnement/confirmation",
        webhook_url: "https://vitalya.africa/api/payments/moneyfusion/webhook",
      }),
      signal: AbortSignal.timeout(20000),
    })
    const text = await response.text()
    let body: { statut?: unknown; message?: unknown; token?: unknown; url?: unknown } | null = null
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
    const ok = response.ok && typeof body?.token === "string" && typeof body?.url === "string"
    if (!ok) console.error(`IP non autorisée ${ip}`, `(MoneyFusion HTTP ${response.status} : ${String(body?.message ?? text.slice(0, 200))})`)
    return {
      configured: true, ip, ok, ms: Date.now() - started, http: response.status,
      statut: body?.statut, message: body?.message ?? (body ? undefined : text.slice(0, 200)),
    }
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    console.error(`IP non autorisée ${ip}`, `(MoneyFusion sans réponse : ${message})`)
    return { configured: true, ip, ok: false, ms: Date.now() - started, error: message }
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

  // ─── Authentification du serveur Vitalya ───
  const secret = req.headers.get("x-payment-secret") ?? ""
  const { data: stored } = await admin.from("app_secrets").select("sha256_hex").eq("name", "payment_webhook").maybeSingle()
  if (!secret || !stored || stored.sha256_hex !== (await sha256Hex(secret))) return json({ error: "forbidden" }, 403)

  const body = (await req.json().catch(() => null)) as { provider?: unknown; reference?: unknown; diagnostic?: unknown } | null
  if (body?.diagnostic === "moneyfusion") return json(await diagnoseMoneyFusion())

  const provider = body?.provider === "pawapay" || body?.provider === "moneyfusion" ? body.provider : null
  const rawReference = typeof body?.reference === "string" ? body.reference : ""
  if (!provider || !(provider === "pawapay" ? UUID.test(rawReference) : MF_TOKEN.test(rawReference))) {
    return json({ error: "invalid_request" }, 400)
  }
  const reference = provider === "pawapay" ? rawReference.toLowerCase() : rawReference

  // ─── Vérification auprès du prestataire ───
  let verified: Verified
  try {
    verified = provider === "pawapay" ? await verifyPawapay(reference) : await verifyMoneyFusion(reference)
  } catch (error) {
    console.error("verify", provider, String(error))
    verified = null
  }
  if (!verified) return json({ outcome: "error" }, 502)
  if (verified.status === "unknown") return json({ outcome: "unknown" })
  if (verified.status === "pending") return json({ outcome: "pending" })

  // Le montant encaissé ne compte que s'il est dans la devise du paiement
  const { data: expected } = await admin
    .from("subscriptions")
    .select("currency")
    .eq(provider === "pawapay" ? "pawapay_checkout_id" : "moneyfusion_token", reference)
    .maybeSingle()
  const paidAmount =
    verified.status === "paid" && verified.paidAmount !== null && (provider === "moneyfusion" || verified.currency === expected?.currency)
      ? verified.paidAmount
      : 0

  // ─── Enregistrement (idempotent) ───
  const { data, error } = await admin
    .rpc("confirm_payment", {
      p_secret: secret,
      p_provider: provider,
      p_reference: reference,
      p_status: verified.status,
      p_paid_amount: paidAmount,
    })
    .maybeSingle<{
      payment_id: string
      user_email: string
      user_name: string | null
      tier: string
      period_end: string | null
      newly_activated: boolean
      first_subscription: boolean
    }>()

  if (error || !data) {
    const message = error?.message ?? "aucune ligne"
    console.error("confirm_payment", provider, message)
    if (message.includes("payment_not_found")) return json({ outcome: "unknown" })
    if (message.includes("amount_mismatch")) {
      await admin.from("payment_logs").insert({
        provider_attempted: provider, provider_used: provider, status: "payment_failed",
        error_message: `Montant encaissé insuffisant (${verified.paidAmount ?? 0} ${verified.currency ?? ""})`,
      })
      return json({ outcome: "rejected" })
    }
    return json({ outcome: "error" }, 500)
  }

  const { data: sub } = await admin.from("subscriptions").select("user_id, amount, currency, status").eq("id", data.payment_id).maybeSingle()

  // Journal : uniquement lors d'un changement d'état (pas de doublon à chaque relecture)
  if (data.newly_activated || verified.status === "failed") {
    const { count: alreadyLogged } = data.newly_activated
      ? { count: 0 }
      : await admin.from("payment_logs").select("id", { count: "exact", head: true }).eq("payment_id", data.payment_id).eq("status", "payment_failed")
    if (data.newly_activated || (sub?.status === "failed" && !alreadyLogged)) {
      await admin.from("payment_logs").insert({
        user_id: sub?.user_id ?? null, payment_id: data.payment_id, amount: sub?.amount ?? null, currency: sub?.currency ?? null,
        provider_attempted: provider, provider_used: provider, status: verified.status === "paid" ? "paid" : "payment_failed",
      })
    }
  }

  return json({ outcome: verified.status, payment: { ...data, amount: sub?.amount ?? null, currency: sub?.currency ?? null } })
})
