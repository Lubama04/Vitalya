import Image from "next/image"
import Link from "next/link"
import { getCategories } from "@/lib/data"
import { NewsletterForm } from "@/components/newsletter-form"

export async function SiteFooter() {
  const categories = await getCategories()
  const year = new Date().getFullYear()

  return (
    <footer className="mt-24 bg-nuit text-white/80">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <div className="flex items-center gap-3">
            <Image src="/brand/emblem.webp" alt="" width={48} height={48} className="size-12" />
            <div>
              <p className="font-heading text-2xl font-bold tracking-wide text-white">VITALYA</p>
              <p className="text-[0.65rem] tracking-[0.2em] text-or uppercase">Santé · Beauté · Bien-être</p>
            </div>
          </div>
          <p className="mt-5 font-heading text-lg italic text-white">Vivre mieux, naturellement.</p>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            Le magazine digital francophone qui célèbre la santé, la beauté et le bien-être africains.
          </p>
        </div>

        <div>
          <h2 className="mb-4 font-sans text-sm font-semibold tracking-wider text-white uppercase">Rubriques</h2>
          <ul className="space-y-2.5 text-sm">
            {categories.map((category) => (
              <li key={category.id}>
                <Link href={`/categories/${category.slug}`} className="transition-colors hover:text-or">
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-4 font-sans text-sm font-semibold tracking-wider text-white uppercase">Le magazine</h2>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/articles" className="transition-colors hover:text-or">Tous les articles</Link></li>
            <li><Link href="/abonnement" className="transition-colors hover:text-or">Abonnements</Link></li>
            <li><Link href="/profil" className="transition-colors hover:text-or">Mon espace</Link></li>
            <li><Link href="/auth" className="transition-colors hover:text-or">Connexion</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="mb-4 font-sans text-sm font-semibold tracking-wider text-white uppercase">La lettre Vitalya</h2>
          <p className="mb-4 text-sm text-white/60">Nos meilleurs conseils, chaque semaine, dans votre boîte mail.</p>
          <NewsletterForm variant="dark" />
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-white/50 sm:flex-row sm:px-6">
          <p>© {year} Vitalya. Tous droits réservés.</p>
          <p>Les contenus de Vitalya ne remplacent pas un avis médical.</p>
        </div>
      </div>
    </footer>
  )
}
