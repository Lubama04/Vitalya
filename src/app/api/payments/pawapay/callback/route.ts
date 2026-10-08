import { NextResponse, type NextRequest } from "next/server"
import { features } from "@/lib/env.server"
import { verifyAndConfirmPayment } from "@/lib/payments/confirm"

// Callback PawaPay (URL à déclarer dans le tableau de bord PawaPay, section Callbacks).
// Le contenu reçu sert uniquement à identifier le paiement : son état est toujours
// relu auprès de l'API PawaPay avant toute activation.
export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type CallbackBody = {
  checkoutId?: unknown
  clientReferenceId?: unknown
  data?: { checkoutId?: unknown; clientReferenceId?: unknown }
}

export async function POST(request: NextRequest) {
  if (!features.pawapay) return NextResponse.json({ received: false }, { status: 503 })

  const body = (await request.json().catch(() => null)) as CallbackBody | null
  const reference = [body?.checkoutId, body?.data?.checkoutId, body?.clientReferenceId, body?.data?.clientReferenceId].find(
    (value): value is string => typeof value === "string" && UUID.test(value),
  )
  if (!reference) return NextResponse.json({ received: false }, { status: 400 })

  const outcome = await verifyAndConfirmPayment("pawapay", reference.toLowerCase())
  // 200 pour tout état connu (évite les renvois inutiles) ; 500 si PawaPay était injoignable → nouvel essai
  return NextResponse.json({ received: true, outcome }, { status: outcome === "error" ? 500 : 200 })
}
