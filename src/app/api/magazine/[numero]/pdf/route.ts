import { after, NextResponse, type NextRequest } from "next/server"
import { getViewer, isStaff } from "@/lib/auth"
import { getCachedMagazine, storeCachedMagazine } from "@/lib/magazine/cache"
import { buildMagazineArticles, buildMagazineEdition, canDownloadMagazine, getEdition } from "@/lib/magazine/data"
import { renderMagazinePdf } from "@/lib/magazine/pdf"
import { createClient } from "@/lib/supabase/server"

// Magazine en PDF, généré à la demande selon la formule du lecteur puis mis en cache 1 h :
// non connecté → /auth ; Gratuit → /abonnement ; Premium → articles Expert remplacés par un encart ;
// Expert → complet ; équipe (admin, éditeur) → complet, articles non publiés compris.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params
  const number = Number.parseInt(numero, 10)
  if (!Number.isInteger(number) || number < 1 || number > 9999) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const viewer = await getViewer()
  if (!viewer) return NextResponse.redirect(new URL(`/auth?next=${encodeURIComponent("/magazine")}`, request.url), 303)
  const staff = isStaff(viewer)
  if (!canDownloadMagazine(viewer.tier, staff)) return NextResponse.redirect(new URL("/abonnement", request.url), 303)

  const edition = await getEdition(number)
  if (!edition) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const numeroLabel = String(edition.numero).padStart(2, "0")
  const filename = `vitalya-n${numeroLabel}.pdf`
  // Une variante par niveau d'accès ; le nom change à chaque modification du numéro
  const variant = staff ? "equipe" : viewer.tier === "expert" ? "expert" : "premium"
  const cachePath = `n${numeroLabel}/${variant}-${Math.floor(new Date(edition.updatedAt).getTime() / 1000)}.pdf`
  // Aperçu de l'équipe (?apercu=1) : toujours régénéré, affiché dans le navigateur
  const preview = staff && request.nextUrl.searchParams.get("apercu") === "1"

  if (!preview) {
    const cached = await getCachedMagazine(cachePath, filename)
    if (cached) return NextResponse.redirect(cached, 302)
  }

  const supabase = await createClient()
  const articles = await buildMagazineArticles(supabase, edition, viewer.tier, staff)
  const pdf = await renderMagazinePdf(await buildMagazineEdition(edition, articles), articles)
  if (!preview) after(() => storeCachedMagazine(cachePath, pdf))

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="${filename}"`,
      // Contenu propre à chaque formule : jamais en cache partagé
      "Cache-Control": "private, no-store",
    },
  })
}
