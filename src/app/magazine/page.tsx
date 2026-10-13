import type { Metadata } from "next"
import Link from "next/link"
import { BookOpen, Crown, FileDown, Gem, Lock } from "lucide-react"
import { ContentImage } from "@/components/content-image"
import { Button } from "@/components/ui/button"
import { getViewer, isStaff } from "@/lib/auth"
import { ACCESS_LABELS } from "@/lib/constants"
import { canDownloadMagazine, editionLabel, getEditions } from "@/lib/magazine/data"

export const metadata: Metadata = {
  title: "Le magazine en PDF",
  description: "Téléchargez chaque numéro de Vitalya en PDF : tous les articles du numéro, à lire hors ligne.",
  alternates: { canonical: "/magazine" },
}

export default async function MagazinePage({ searchParams }: { searchParams: Promise<{ acces?: string }> }) {
  const [{ acces }, viewer, editions] = await Promise.all([searchParams, getViewer(), getEditions()])
  const staff = viewer ? isStaff(viewer) : false
  const eligible = viewer ? canDownloadMagazine(viewer.tier, staff) : false
  const fullAccess = staff || viewer?.tier === "expert"

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <header className="mb-12 max-w-2xl">
        <p className="text-sm font-semibold tracking-wider text-orange-fonce uppercase">Le magazine</p>
        <h1 className="mt-1 text-4xl font-bold text-nuit sm:text-5xl">Vitalya en PDF</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Chaque numéro réunit ses articles dans un magazine à télécharger, à lire hors ligne ou à imprimer.
        </p>
      </header>

      {acces === "premium" && !eligible && (
        <p role="status" className="mb-8 rounded-xl bg-or/20 px-5 py-4 text-sm text-nuit">
          Le téléchargement du magazine est réservé aux abonnés Premium et Expert.
        </p>
      )}

      {editions.length === 0 && (
        <p className="rounded-2xl bg-vert-pale/50 p-10 text-center text-muted-foreground">Aucun numéro disponible.</p>
      )}

      <div className="space-y-10">
        {editions.map((edition) => {
          const numero = String(edition.numero).padStart(2, "0")
          return (
            <article
              key={edition.id}
              className="grid gap-8 rounded-3xl border bg-white p-6 shadow-sm sm:p-8 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]"
            >
              <div className="relative mx-auto aspect-[900/1273] w-full max-w-[260px] overflow-hidden rounded-xl bg-vert-pale shadow-lg">
                {edition.couvertureUrl ? (
                  <ContentImage src={edition.couvertureUrl} alt={`Couverture de ${edition.titre}`} fill sizes="260px" className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center font-heading text-5xl text-vert-fonce/40">N°{numero}</div>
                )}
              </div>
              <div className="flex min-w-0 flex-col justify-center">
                <p className="text-sm font-semibold tracking-wider text-orange-fonce uppercase">Numéro {numero}</p>
                <h2 className="mt-1 text-3xl font-bold break-words text-nuit">{edition.titre}</h2>
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>{editionLabel(edition)}</span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="size-4" aria-hidden /> {edition.articleIds.length} articles
                  </span>
                </p>
                <ul className="mt-5 list-disc space-y-1.5 pl-5 text-sm text-nuit/80">
                  <li>Couverture, sommaire paginé et tous les articles du numéro</li>
                  <li>Abonnés Premium : articles Expert présentés en résumé</li>
                  <li>Abonnés Expert : magazine intégral, sans restriction</li>
                </ul>

                <div className="mt-7">
                  {eligible ? (
                    <div className="space-y-2">
                      <Button asChild size="lg" className="cta-pulse h-12 bg-vert-fonce px-6 text-base font-semibold text-white hover:bg-vert-fonce/90">
                        <a href={`/api/magazine/${edition.numero}/pdf`} download={`vitalya-n${numero}.pdf`}>
                          <FileDown className="size-5" aria-hidden /> Télécharger le N°{numero} (PDF)
                        </a>
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        {fullAccess
                          ? "Version intégrale. La génération prend quelques secondes."
                          : "Version Premium : les articles Expert y figurent en résumé. La génération prend quelques secondes."}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-nuit p-5 text-white">
                      <p className="flex items-center gap-2 font-semibold">
                        <Lock className="size-4 text-or" aria-hidden /> Téléchargement réservé aux abonnés
                      </p>
                      <p className="mt-1 text-sm text-white/80">
                        Niveau requis : <Crown className="inline size-4 text-or" aria-hidden /> {ACCESS_LABELS.premium} (articles Expert en
                        résumé) ou <Gem className="inline size-4 text-or" aria-hidden /> {ACCESS_LABELS.expert} (magazine intégral).
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button asChild className="bg-orange font-semibold text-nuit hover:bg-orange/90">
                          <Link href="/abonnement">Voir les abonnements</Link>
                        </Button>
                        {!viewer && (
                          <Button asChild variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                            <Link href="/auth?next=/magazine">Se connecter</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
