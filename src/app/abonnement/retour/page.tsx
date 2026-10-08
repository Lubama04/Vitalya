import { redirect } from "next/navigation"

// Ancienne adresse de retour : redirige vers /abonnement/confirmation en conservant les paramètres
export default async function LegacyReturnPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) if (value) params.set(key, value)
  redirect(`/abonnement/confirmation${params.size ? `?${params}` : ""}`)
}
