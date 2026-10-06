import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

/** Désinscription « en un clic » (RFC 8058, en-tête List-Unsubscribe-Post). */
export async function POST(request: NextRequest) {
  const token = z.uuid().safeParse(request.nextUrl.searchParams.get("token"))
  if (!token.success) return NextResponse.json({ error: "Jeton invalide" }, { status: 400 })

  const supabase = await createClient()
  await supabase.rpc("unsubscribe_newsletter", { p_token: token.data })
  return NextResponse.json({ ok: true })
}
