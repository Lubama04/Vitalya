// Edge Function « import-covers » : couvertures d'articles depuis l'API Unsplash.
// Pour chaque article : recherche avec les mots-clés EXACTS fournis, première photo retournée,
// déclenchement du « download » (exigé par les règles de l'API Unsplash), envoi dans le bucket
// article-media (covers/<slug>.jpg) puis mise à jour de articles.cover_image.
//
// Protégée par l'en-tête x-payment-secret (même secret serveur que confirm-payment).
// Secret requis : UNSPLASH_ACCESS_KEY (clé « Access Key » d'une application unsplash.com/developers).
// Corps : { "dryRun": true } pour seulement lister les photos qui seraient retenues.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const UNSPLASH_ACCESS_KEY = Deno.env.get("UNSPLASH_ACCESS_KEY") ?? ""

// Mots-clés exacts par article (ne pas reformuler)
const ARTICLES: { slug: string; query: string }[] = [
  { slug: "huile-de-baobab-le-secret-que-lafrique-gardait", query: "baobab oil african woman skincare" },
  { slug: "routine-beaute-peau-noire-5-etapes", query: "african woman skincare routine natural" },
  { slug: "cheveux-afro-7-erreurs-qui-cassent-boucles", query: "afro natural hair black woman" },
  { slug: "moringa-verites-et-mensonges", query: "moringa leaves powder plant africa" },
  { slug: "7-signaux-diabete-type-2", query: "african doctor patient health checkup" },
  { slug: "burn-out-afrique-personne-en-parle", query: "african woman stress work tired" },
  { slug: "fonio-sorgho-millet-superaliments-africains", query: "fonio millet grains african cereals" },
  { slug: "5-erreurs-skincare-peau-foncee", query: "african woman face skincare dark skin" },
]

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

type UnsplashPhoto = {
  id: string
  description: string | null
  alt_description: string | null
  urls: { raw: string }
  links: { html: string; download_location: string }
  user: { name: string; links: { html: string } }
}

const unsplash = (url: string) =>
  fetch(url, { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`, "Accept-Version": "v1" }, signal: AbortSignal.timeout(15000) })

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

  const secret = req.headers.get("x-payment-secret") ?? ""
  const { data: stored } = await admin.from("app_secrets").select("sha256_hex").eq("name", "payment_webhook").maybeSingle()
  if (!secret || !stored || stored.sha256_hex !== (await sha256Hex(secret))) return json({ error: "forbidden" }, 403)
  if (!UNSPLASH_ACCESS_KEY) return json({ error: "UNSPLASH_ACCESS_KEY manquant dans les secrets Edge Functions" }, 412)

  const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean }
  const results = []

  for (const article of ARTICLES) {
    try {
      const search = await unsplash(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(article.query)}&per_page=1&page=1`,
      )
      if (!search.ok) throw new Error(`Recherche Unsplash HTTP ${search.status} : ${(await search.text()).slice(0, 200)}`)
      const photo = ((await search.json()) as { results?: UnsplashPhoto[] }).results?.[0]
      if (!photo) throw new Error("Aucune photo retournée")

      const info = {
        slug: article.slug,
        query: article.query,
        photoId: photo.id,
        description: photo.alt_description ?? photo.description,
        photographer: photo.user.name,
        photographerUrl: `${photo.user.links.html}?utm_source=vitalya&utm_medium=referral`,
        unsplashUrl: `${photo.links.html}?utm_source=vitalya&utm_medium=referral`,
      }
      if (body.dryRun) {
        results.push({ ...info, status: "aperçu" })
        continue
      }

      // Déclenchement du téléchargement (obligatoire selon les règles de l'API Unsplash)
      await unsplash(photo.links.download_location)

      // Image redimensionnée par le CDN Unsplash (1600 px, JPEG qualité 80)
      const image = await fetch(`${photo.urls.raw}&w=1600&q=80&fm=jpg&fit=max`, { signal: AbortSignal.timeout(30000) })
      if (!image.ok) throw new Error(`Téléchargement HTTP ${image.status}`)
      const bytes = new Uint8Array(await image.arrayBuffer())

      const path = `covers/${article.slug}.jpg`
      const { error: uploadError } = await admin.storage
        .from("article-media")
        .upload(path, bytes, { contentType: "image/jpeg", upsert: true, cacheControl: "31536000" })
      if (uploadError) throw new Error(`Envoi Storage : ${uploadError.message}`)

      const publicUrl = admin.storage.from("article-media").getPublicUrl(path).data.publicUrl
      // Paramètre de version : force le rafraîchissement des caches si l'image est remplacée
      const coverUrl = `${publicUrl}?v=${photo.id}`
      const { error: updateError } = await admin.from("articles").update({ cover_image: coverUrl }).eq("slug", article.slug)
      if (updateError) throw new Error(`Mise à jour article : ${updateError.message}`)

      results.push({ ...info, status: "importée", sizeKb: Math.round(bytes.length / 1024), coverUrl })
    } catch (error) {
      results.push({ slug: article.slug, query: article.query, status: "échec", error: error instanceof Error ? error.message : String(error) })
    }
  }

  return json({ results })
})
