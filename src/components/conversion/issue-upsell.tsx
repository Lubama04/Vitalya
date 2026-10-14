import Link from "next/link"
import { Crown, Gem } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatFcfa, PRICING } from "@/lib/constants"
import type { ReservedArticle } from "@/lib/data"

const PREMIUM_PRICE = PRICING.find((tier) => tier.id === "premium")?.priceFcfa ?? 6000

/** Fin d'un article gratuit (lecteur connecté gratuit) : les titres réservés du numéro, sans leur contenu. */
export function IssueUpsell({ articles }: { articles: ReservedArticle[] }) {
  const count = articles.length
  const waiting =
    count > 1 ? `${count} autres articles vous attendent dans ce numéro.` : count === 1 ? "Un autre article vous attend dans ce numéro." : "Tout le numéro vous attend."

  return (
    <aside aria-labelledby="titre-suite-numero" className="mt-14 overflow-hidden rounded-3xl bg-vert-fonce p-6 text-white sm:p-10">
      <h2 id="titre-suite-numero" className="font-heading text-2xl font-bold sm:text-3xl">
        Vous avez aimé cet article ?
      </h2>
      <p className="mt-2 text-white/85 sm:text-lg">{waiting}</p>

      {count > 0 && (
        <ul className="mt-6 space-y-3">
          {articles.map((article) => {
            const Icon = article.accessLevel === "expert" ? Gem : Crown
            return (
              <li key={article.id} className="flex items-start gap-3 border-b border-white/15 pb-3 last:border-0 last:pb-0">
                <Icon className="mt-1 size-4 shrink-0 text-or" aria-hidden />
                <Link href={`/articles/${article.slug}`} className="font-heading text-base leading-snug hover:underline sm:text-lg">
                  {article.title}
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <Button asChild size="lg" className="mt-8 h-12 w-full bg-orange px-6 text-base text-nuit hover:bg-orange/90 sm:w-auto">
        <Link href="/abonnement">S&apos;abonner pour {formatFcfa(PREMIUM_PRICE)}/mois</Link>
      </Button>
    </aside>
  )
}
