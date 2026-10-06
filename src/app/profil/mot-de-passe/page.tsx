import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PasswordForm } from "@/components/profile/password-form"
import { requireViewer } from "@/lib/auth"

export const metadata: Metadata = { title: "Mot de passe", robots: { index: false } }

export default async function PasswordPage() {
  await requireViewer("/profil/mot-de-passe")

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <Link href="/profil" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-nuit">
        <ArrowLeft className="size-4" /> Mon espace
      </Link>
      <h1 className="text-3xl font-bold text-nuit">Nouveau mot de passe</h1>
      <p className="mt-2 mb-8 text-muted-foreground">Choisissez un mot de passe d&apos;au moins 8 caractères.</p>
      <PasswordForm />
    </div>
  )
}
