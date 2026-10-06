import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Désinscription", robots: { index: false } }

// Désinscription en deux temps (bouton de confirmation) : les robots qui
// pré-chargent les liens des emails ne désinscrivent personne par erreur.
async function confirmUnsubscribe(formData: FormData) {
  "use server"
  const token = z.uuid().safeParse(formData.get("token"))
  if (!token.success) redirect("/newsletter/desinscription?statut=invalide")
  const supabase = await createClient()
  await supabase.rpc("unsubscribe_newsletter", { p_token: token.data })
  redirect("/newsletter/desinscription?statut=ok")
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; statut?: string }>
}) {
  const { token, statut } = await searchParams

  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-3xl font-bold text-vert-fonce">Lettre Vitalya</h1>
      {statut === "ok" ? (
        <p className="mt-4 text-muted-foreground">
          C&apos;est fait : vous ne recevrez plus notre newsletter. Vous pouvez vous réinscrire à tout moment depuis le site.
        </p>
      ) : statut === "invalide" || !token ? (
        <p className="mt-4 text-muted-foreground">Ce lien de désinscription est invalide.</p>
      ) : (
        <form action={confirmUnsubscribe} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <p className="mb-6 text-muted-foreground">Confirmez-vous ne plus vouloir recevoir la lettre Vitalya ?</p>
          <Button type="submit" className="bg-vert-fonce hover:bg-vert-fonce/90">Me désinscrire</Button>
        </form>
      )}
      <Link href="/" className="mt-10 inline-block text-sm text-vert-emeraude underline">Retour au magazine</Link>
    </div>
  )
}
