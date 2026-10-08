import "server-only"
import { serverEnv } from "@/lib/env.server"

// Client MoneyFusion (FusionPay) : carte bancaire, Wave, Orange Money, MTN, Moov…
// L'URL de création est propre à chaque marchand (MONEYFUSION_API_URL, tableau de bord MoneyFusion).

const STATUS_URL = "https://pay.moneyfusion.net/paiementNotif"

export type MoneyFusionCreateResult =
  | { ok: true; token: string; url: string }
  | { ok: false; message: string }

export async function createMoneyFusionPayment(input: {
  paymentId: string
  amount: number
  label: string
  phone: string
  customerName: string
  returnUrl: string
  webhookUrl: string
}): Promise<MoneyFusionCreateResult> {
  if (!serverEnv.MONEYFUSION_API_URL) return { ok: false, message: "MoneyFusion non configuré" }
  try {
    const response = await fetch(serverEnv.MONEYFUSION_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        totalPrice: input.amount,
        article: [{ [input.label]: input.amount }],
        personal_Info: [{ paymentId: input.paymentId }],
        numeroSend: input.phone,
        nomclient: input.customerName,
        return_url: input.returnUrl,
        webhook_url: input.webhookUrl,
      }),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    })
    const body = (await response.json().catch(() => null)) as {
      statut?: boolean
      token?: string
      message?: string
      url?: string
    } | null
    if (response.ok && body?.statut && body.token && body.url?.startsWith("https://")) {
      return { ok: true, token: body.token, url: body.url }
    }
    return { ok: false, message: body?.message ?? `Réponse MoneyFusion inattendue (HTTP ${response.status})` }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Erreur réseau" }
  }
}

export type MoneyFusionStatus = {
  status: "pending" | "paid" | "failed" | "unknown"
  paidAmount: number | null
}

/** État officiel d'un paiement, lu directement auprès de MoneyFusion (jamais depuis le webhook). */
export async function getMoneyFusionStatus(token: string): Promise<MoneyFusionStatus | null> {
  if (!/^[A-Za-z0-9_-]{6,200}$/.test(token)) return null
  try {
    const response = await fetch(`${STATUS_URL}/${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    })
    if (!response.ok) return null
    const body = (await response.json()) as { statut?: boolean; data?: { statut?: string; Montant?: number | string } }
    if (!body.statut || !body.data) return null
    const raw = body.data.statut
    const status = raw === "paid" ? "paid" : raw === "pending" ? "pending" : raw === "failure" || raw === "failed" || raw === "no paid" ? "failed" : "unknown"
    const amount = Number(body.data.Montant)
    return { status, paidAmount: status === "paid" && Number.isFinite(amount) ? Math.floor(amount) : null }
  } catch (error) {
    console.error("getMoneyFusionStatus", error instanceof Error ? error.message : error)
    return null
  }
}
