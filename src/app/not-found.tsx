import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <Image src="/brand/emblem.webp" alt="" width={96} height={96} className="mb-6 size-24 opacity-90" />
      <p className="font-heading text-7xl font-bold text-vert-fonce">404</p>
      <h1 className="mt-3 text-3xl font-bold">Page introuvable</h1>
      <p className="mt-3 text-muted-foreground">
        Cette page n&apos;existe pas ou a été déplacée. Laissez-vous guider vers nos derniers articles.
      </p>
      <Button asChild className="mt-8 bg-vert-fonce hover:bg-vert-fonce/90">
        <Link href="/">Retour à l&apos;accueil</Link>
      </Button>
    </div>
  )
}
