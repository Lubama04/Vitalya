import { NextResponse, type NextRequest } from "next/server"
import { features } from "@/lib/env.server"
import { verifyAndConfirmPayment } from "@/lib/payments/confirm"

// Webhook MoneyFusion (événements payin.session.pending / completed / cancelled).
// MoneyFusion ne signe pas ses notifications : le jeton reçu sert uniquement à
// relire l'état officiel du paiement auprès de MoneyFusion avant toute activation.
export const dynamic = "force-dynamic"

const TOKEN = /^[A-Za-z0-9_-]{6,200}$/

export async function POST(request: NextRequest) {
  if (!features.moneyfusion) return NextResponse.json({ received: false }, { status: 503 })

  const body = (await request.json().catch(() => null)) as { tokenPay?: unknown; token?: unknown } | null
  const token = [body?.tokenPay, body?.token].find((value): value is string => typeof value === "string" && TOKEN.test(value))
  if (!token) return NextResponse.json({ received: false }, { status: 400 })

  const outcome = await verifyAndConfirmPayment("moneyfusion", token)
  return NextResponse.json({ received: true, outcome }, { status: outcome === "error" ? 500 : 200 })
}
