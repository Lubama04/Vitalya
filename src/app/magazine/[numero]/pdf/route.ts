import { NextResponse, type NextRequest } from "next/server"
import { getViewer, isStaff } from "@/lib/auth"
import { buildMagazineArticles, canDownloadMagazine, editionLabel, getEdition } from "@/lib/magazine/data"
import { renderMagazinePdf } from "@/lib/magazine/pdf"
import { createClient } from "@/lib/supabase/server"

// Téléchargement du magazine en PDF, généré à la demande selon la formule du lecteur :
// Premium → tout, articles Expert en résumé ; Expert (et équipe) → tout.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params
  const number = Number.parseInt(numero, 10)
  if (!Number.isInteger(number) || number < 1) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const viewer = await getViewer()
  if (!viewer) return NextResponse.redirect(new URL(`/auth?next=${encodeURIComponent("/magazine")}`, request.url), 303)
  const staff = isStaff(viewer)
  // Gratuit : pas de téléchargement, retour vers la page du magazine (niveau requis affiché)
  if (!canDownloadMagazine(viewer.tier, staff)) return NextResponse.redirect(new URL("/magazine?acces=premium", request.url), 303)

  const edition = await getEdition(number)
  if (!edition) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const supabase = await createClient()
  const articles = await buildMagazineArticles(supabase, edition, viewer.tier, staff)
  const pdf = await renderMagazinePdf({ numero: edition.numero, titre: edition.titre, label: editionLabel(edition) }, articles)

  const filename = `vitalya-n${String(edition.numero).padStart(2, "0")}.pdf`
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Contenu propre à chaque abonné : jamais mis en cache partagé
      "Cache-Control": "private, no-store",
    },
  })
}
