import type { Metadata } from "next"
import Image from "next/image"
import { redirect } from "next/navigation"
import { AuthForms } from "@/components/auth/auth-forms"
import { getViewer, safeRedirectPath } from "@/lib/auth"

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connectez-vous ou créez votre compte Vitalya.",
  robots: { index: false },
}

const ERRORS: Record<string, string> = {
  lien: "Ce lien est invalide ou a expiré. Demandez-en un nouveau.",
}

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string; erreur?: string }>
}) {
  const params = await searchParams
  const next = safeRedirectPath(params.next, "/profil")

  // Déjà connecté : on renvoie vers la destination
  if (await getViewer()) redirect(next)

  return (
    <div className="grid min-h-[calc(100dvh-6rem)] lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden lg:block">
        <Image src="/covers/moringa.webp" alt="" fill priority sizes="50vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-vert-fonce via-vert-fonce/40 to-transparent" />
        <div className="absolute right-0 bottom-0 left-0 p-12 text-white">
          <p className="font-heading text-4xl leading-tight font-bold">
            Rejoignez la communauté <span className="text-or italic">Vitalya</span>
          </p>
          <p className="mt-3 max-w-md text-white/80">
            Commentez, sauvegardez vos articles préférés et recevez nos conseils chaque semaine.
          </p>
        </div>
      </aside>

      <div className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <Image src="/brand/emblem.webp" alt="" width={64} height={64} className="mx-auto mb-4 size-16" />
            <h1 className="text-3xl font-bold text-nuit">Bienvenue</h1>
            <p className="mt-2 text-muted-foreground font-heading italic">Vivre mieux, naturellement.</p>
          </div>
          {params.erreur && ERRORS[params.erreur] && (
            <p role="alert" className="mb-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {ERRORS[params.erreur]}
            </p>
          )}
          <AuthForms next={next} defaultTab={params.mode === "inscription" ? "inscription" : "connexion"} />
        </div>
      </div>
    </div>
  )
}
