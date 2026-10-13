// Edge Function « magazine-cache » : cache des PDF du magazine (bucket privé « magazines-pdf »).
// Appelée uniquement par le serveur Vitalya (en-tête x-payment-secret, comparé à l'empreinte
// stockée dans public.app_secrets). Les lecteurs n'accèdent jamais directement au bucket :
// ils reçoivent un lien signé de courte durée vers la variante correspondant à leur formule.
//
// { action: "get", path, maxAgeSeconds, filename } → { hit: true, url } | { hit: false }
// { action: "put", path, data (base64) }            → { stored: true }
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { decodeBase64 } from "jsr:@std/encoding@1/base64"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const BUCKET = "magazines-pdf"
// Chemin attendu : n01/premium-1760000000.pdf
const PATH = /^n\d{2,4}\/[a-z]+-\d+\.pdf$/

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

  const secret = req.headers.get("x-payment-secret") ?? ""
  const { data: stored } = await admin.from("app_secrets").select("sha256_hex").eq("name", "payment_webhook").maybeSingle()
  if (!secret || !stored || stored.sha256_hex !== (await sha256Hex(secret))) return json({ error: "forbidden" }, 403)

  const body = (await req.json().catch(() => null)) as
    | { action?: string; path?: string; maxAgeSeconds?: number; filename?: string; data?: string }
    | null
  const path = typeof body?.path === "string" && PATH.test(body.path) ? body.path : null
  if (!path) return json({ error: "invalid_path" }, 400)

  if (body?.action === "get") {
    const [folder, name] = path.split("/")
    const { data: files } = await admin.storage.from(BUCKET).list(folder, { search: name, limit: 5 })
    const file = files?.find((item) => item.name === name)
    const stamp = file?.updated_at ?? file?.created_at
    const age = stamp ? (Date.now() - new Date(stamp).getTime()) / 1000 : Infinity
    if (!file || age > Math.min(Math.max(body.maxAgeSeconds ?? 3600, 60), 86400)) return json({ hit: false })
    const filename = typeof body.filename === "string" && /^[\w.-]{3,80}$/.test(body.filename) ? body.filename : true
    const { data: signed, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 300, { download: filename })
    if (error || !signed) return json({ hit: false })
    return json({ hit: true, url: signed.signedUrl })
  }

  if (body?.action === "put") {
    if (typeof body.data !== "string" || body.data.length > 70_000_000) return json({ error: "invalid_data" }, 400)
    const bytes = decodeBase64(body.data)
    // Anciennes versions du même numéro et de la même formule supprimées (nom horodaté)
    const [folder, name] = path.split("/")
    const variant = name.split("-")[0]
    const { data: previous } = await admin.storage.from(BUCKET).list(folder, { search: `${variant}-`, limit: 50 })
    const stale = (previous ?? []).filter((item) => item.name !== name && item.name.startsWith(`${variant}-`)).map((item) => `${folder}/${item.name}`)
    if (stale.length) await admin.storage.from(BUCKET).remove(stale)
    const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: "application/pdf", upsert: true, cacheControl: "60" })
    if (error) return json({ error: error.message }, 500)
    return json({ stored: true })
  }

  return json({ error: "invalid_action" }, 400)
})
