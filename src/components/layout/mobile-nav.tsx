"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

type NavCategory = { id: string; name: string; slug: string; color: string }

export function MobileNav({ categories }: { categories: NavCategory[] }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Ouvrir le menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80">
        <SheetHeader>
          <SheetTitle className="font-heading text-2xl text-vert-fonce">Vitalya</SheetTitle>
          <p className="font-heading text-sm italic text-muted-foreground">Vivre mieux, naturellement.</p>
        </SheetHeader>
        <nav aria-label="Navigation mobile" className="flex flex-col gap-1 px-4">
          <Link href="/" onClick={close} className="rounded-lg px-3 py-2.5 font-medium hover:bg-vert-pale">
            Accueil
          </Link>
          <Link href="/articles" onClick={close} className="rounded-lg px-3 py-2.5 font-medium hover:bg-vert-pale">
            Tous les articles
          </Link>
          <p className="mt-4 mb-1 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Rubriques
          </p>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              onClick={close}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-vert-pale"
            >
              <span className="size-2.5 rounded-full" style={{ backgroundColor: category.color }} aria-hidden />
              {category.name}
            </Link>
          ))}
          <div className="mt-6 flex flex-col gap-2 border-t pt-6">
            <Button asChild className="bg-orange text-white hover:bg-orange/90">
              <Link href="/abonnement" onClick={close}>Découvrir les abonnements</Link>
            </Button>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
