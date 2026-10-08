import Image from "next/image"
import Link from "next/link"
import { getViewer, isStaff } from "@/lib/auth"
import { getCategories } from "@/lib/data"
import { Button } from "@/components/ui/button"
import { MobileNav } from "@/components/layout/mobile-nav"
import { UserMenu } from "@/components/layout/user-menu"

export async function SiteHeader() {
  const [viewer, categories] = await Promise.all([getViewer(), getCategories()])

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-white/90 backdrop-blur-md supports-[backdrop-filter]:bg-white/75">
      {/* Bandeau slogan */}
      <div className="hidden bg-vert-fonce text-white sm:block">
        <div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-4 text-xs tracking-wide sm:px-6">
          <span className="font-heading italic">Vivre mieux, naturellement.</span>
          <span className="uppercase opacity-80">Santé · Beauté · Bien-être</span>
        </div>
      </div>

      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <MobileNav categories={categories} />

        <Link href="/" className="flex shrink-0 items-center" aria-label="Accueil Vitalya">
          <Image
            src="/brand/logo.webp"
            alt="Vitalya"
            width={168}
            height={52}
            priority
            className="h-10 w-auto sm:h-11"
          />
        </Link>

        <nav aria-label="Navigation principale" className="ml-6 hidden flex-1 items-center gap-1 lg:flex">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-nuit/80 transition-colors hover:bg-vert-pale hover:text-vert-fonce"
            >
              {category.name}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {viewer ? (
            <UserMenu
              name={viewer.fullName ?? viewer.email}
              email={viewer.email}
              avatarUrl={viewer.avatarUrl}
              tier={viewer.tier}
              isStaff={isStaff(viewer)}
            />
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/auth">Connexion</Link>
              </Button>
              <Button asChild size="sm" className="bg-orange text-white hover:bg-orange/90">
                <Link href="/abonnement">S&apos;abonner</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
