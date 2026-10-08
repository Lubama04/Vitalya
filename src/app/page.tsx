import Image from "next/image"
import Link from "next/link"
import { ArrowRight, BookOpen, Crown, Leaf, Sparkles } from "lucide-react"
import { ArticleCard } from "@/components/article/article-card"
import { NewsletterForm } from "@/components/newsletter-form"
import { Button } from "@/components/ui/button"
import { getCategories, getLatestArticles } from "@/lib/data"
import { PRICING, textOn } from "@/lib/constants"

// Page publique mise en cache (ISR) : régénérée toutes les 5 minutes,
// et immédiatement à chaque publication (revalidatePath dans le back-office).
export const revalidate = 300

export default async function HomePage() {
  const [{ articles }, categories] = await Promise.all([
    getLatestArticles({ limit: 7 }),
    getCategories(),
  ])
  const [featured, ...others] = articles

  return (
    <>
      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-vert-fonce text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div aria-hidden className="absolute -top-32 -right-32 size-[30rem] rounded-full bg-vert-emeraude/30 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
          <div>
            <div className="mb-8 flex items-center gap-4">
              <Image src="/brand/emblem.webp" alt="" width={72} height={72} priority className="size-16 drop-shadow-lg sm:size-[4.5rem]" />
              <div>
                <p className="font-heading text-3xl font-bold tracking-[0.12em] sm:text-4xl">VITALYA</p>
                <div className="my-1.5 h-px w-full bg-or/70" />
                <p className="text-[0.7rem] tracking-[0.25em] text-white/80 uppercase">Santé · Beauté · Bien-être</p>
              </div>
            </div>
            <h1 className="font-heading text-5xl leading-[1.05] font-bold text-balance sm:text-6xl lg:text-7xl">
              Vivre mieux,
              <br />
              <span className="text-or italic">naturellement.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/80">
              Le magazine digital qui puise dans les savoirs africains et la science pour prendre soin
              de votre corps, de votre peau et de votre esprit.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {featured && (
                <Button asChild size="lg" className="h-12 bg-orange px-6 text-base text-nuit hover:bg-orange/90">
                  <Link href={`/articles/${featured.slug}`}>
                    <BookOpen className="size-5" /> Lire le dernier article
                  </Link>
                </Button>
              )}
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 border-white/30 bg-transparent px-6 text-base text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/abonnement">Découvrir les abonnements</Link>
              </Button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
            <div aria-hidden className="absolute inset-0 translate-x-4 translate-y-4 rotate-3 rounded-2xl bg-or/80" />
            <Image
              src="/covers/volume-01.webp"
              alt="Couverture du Volume 01 de Vitalya : La beauté africaine au naturel"
              width={900}
              height={1273}
              priority
              sizes="(max-width: 1024px) 80vw, 420px"
              className="relative -rotate-2 rounded-2xl shadow-2xl ring-1 ring-white/10 transition-transform duration-500 hover:rotate-0"
            />
            <span className="absolute -top-3 -left-3 rotate-[-8deg] rounded-full bg-orange px-4 py-1.5 text-xs font-bold tracking-wider text-nuit uppercase shadow-lg">
              N°01 · Avril 2026
            </span>
          </div>
        </div>
      </section>

      {/* ─── Derniers articles ────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20" aria-labelledby="titre-une">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-wider text-orange-fonce uppercase">À la une</p>
            <h2 id="titre-une" className="mt-1 text-4xl font-bold text-nuit">Les derniers articles</h2>
          </div>
          <Link href="/articles" className="hidden items-center gap-1 text-sm font-semibold text-vert-fonce hover:underline sm:flex">
            Tout voir <ArrowRight className="size-4" />
          </Link>
        </div>

        {featured ? (
          <div className="space-y-14">
            <div className="rounded-3xl border border-border/80 shadow-sm">
              <ArticleCard article={featured} variant="featured" priority />
            </div>
            {others.length > 0 && (
              <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {others.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="rounded-2xl bg-vert-pale/50 p-10 text-center text-muted-foreground">
            Les premiers articles arrivent très bientôt.
          </p>
        )}
      </section>

      {/* ─── Rubriques ───────────────────────────────────────── */}
      <section className="bg-creme py-16 lg:py-20" aria-labelledby="titre-rubriques">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-10 text-center">
            <p className="text-sm font-semibold tracking-wider text-orange-fonce uppercase">Explorer</p>
            <h2 id="titre-rubriques" className="mt-1 text-4xl font-bold text-nuit">Nos rubriques</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="group relative flex min-h-48 flex-col justify-between overflow-hidden rounded-2xl p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
                style={{ backgroundColor: category.color, color: textOn(category.color) }}
              >
                <Leaf aria-hidden className="absolute -right-4 -bottom-4 size-28 opacity-15 transition-transform duration-500 group-hover:rotate-12" />
                <h3 className="font-heading text-2xl leading-tight font-bold">{category.name}</h3>
                <div>
                  <p className="text-sm line-clamp-3">{category.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold">
                    Lire <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA abonnement ──────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20" aria-labelledby="titre-abonnement">
        <div className="relative overflow-hidden rounded-3xl bg-nuit px-6 py-12 text-white sm:px-12 lg:py-16">
          <div aria-hidden className="absolute -bottom-24 -left-24 size-80 rounded-full bg-vert-emeraude/25 blur-3xl" />
          <div aria-hidden className="absolute -top-24 -right-10 size-72 rounded-full bg-or/20 blur-3xl" />
          <div className="relative grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-or/15 px-3 py-1 text-sm font-semibold text-or">
                <Crown className="size-4" /> Abonnement Vitalya
              </p>
              <h2 id="titre-abonnement" className="mt-4 text-4xl font-bold sm:text-5xl">
                Accédez à <span className="text-or italic">tout</span> le magazine
              </h2>
              <p className="mt-4 max-w-lg text-lg text-white/75">
                Dossiers complets, analyses d&apos;experts et rituels détaillés : soutenez une rédaction
                indépendante dédiée à votre bien-être.
              </p>
              <Button asChild size="lg" className="mt-8 h-12 bg-orange px-6 text-base text-nuit hover:bg-orange/90">
                <Link href="/abonnement">
                  <Sparkles className="size-5" /> Voir les offres
                </Link>
              </Button>
            </div>
            <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {PRICING.map((tier) => (
                <li
                  key={tier.id}
                  className={`rounded-2xl border p-5 ${tier.highlighted ? "border-or bg-white/10" : "border-white/15 bg-white/5"}`}
                >
                  <p className="text-sm font-semibold text-white/70">{tier.name}</p>
                  <p className="mt-1 font-heading text-3xl font-bold">
                    {tier.price === 0 ? "0 €" : `${tier.price} €`}
                    <span className="text-sm font-normal text-white/80"> /mois</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ─── Newsletter ──────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 pb-4 text-center sm:px-6" aria-labelledby="titre-newsletter">
        <h2 id="titre-newsletter" className="text-3xl font-bold text-vert-fonce">La lettre Vitalya</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Chaque semaine, une sélection d&apos;articles, de recettes et de rituels pour vivre mieux, naturellement.
        </p>
        <div className="mx-auto mt-6 max-w-md">
          <NewsletterForm />
        </div>
      </section>
    </>
  )
}
