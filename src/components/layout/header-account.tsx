"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { isAccessLevel, type AccessLevel } from "@/lib/constants"
import { loadSupabase } from "@/lib/supabase/lazy"

// Menu du compte (Radix) : téléchargé seulement pour un lecteur connecté
const UserMenu = dynamic(() => import("@/components/layout/user-menu").then((mod) => mod.UserMenu))

/** Présence d'un cookie de session Supabase (non httpOnly, posé par @supabase/ssr). */
function hasAuthCookie() {
  return document.cookie.split(";").some((part) => part.trim().startsWith("sb-"))
}

type Account = { name: string; email: string; avatarUrl: string | null; tier: AccessLevel; isStaff: boolean }

/**
 * Zone « compte » de l'en-tête, résolue dans le navigateur.
 * L'en-tête ne lit plus les cookies côté serveur : les pages publiques
 * peuvent être servies depuis le cache (forte baisse du temps de réponse).
 * Visiteur anonyme : aucun cookie de session, donc ni supabase-js ni requête.
 */
export function HeaderAccount() {
  const pathname = usePathname()
  const [account, setAccount] = useState<Account | null>(null)

  useEffect(() => {
    if (!hasAuthCookie()) {
      setAccount(null)
      return
    }
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    const load = async () => {
      const supabase = await loadSupabase()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        if (!cancelled) setAccount(null)
        return
      }
      const [{ data: profile }, { data: tier }] = await Promise.all([
        supabase.from("profiles").select("email, full_name, avatar_url, role").eq("id", session.user.id).maybeSingle(),
        supabase.rpc("current_tier"),
      ])
      if (cancelled || !profile) return
      setAccount({
        name: profile.full_name || profile.email,
        email: profile.email,
        avatarUrl: profile.avatar_url,
        tier: isAccessLevel(tier) ? tier : "free",
        isStaff: profile.role === "admin" || profile.role === "editor",
      })
    }

    void load()
    void loadSupabase().then((supabase) => {
      if (cancelled) return
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event !== "INITIAL_SESSION") void load()
      })
      unsubscribe = () => data.subscription.unsubscribe()
    })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
    // Relecture à chaque navigation (connexion / déconnexion via Server Action)
  }, [pathname])

  if (account) {
    return <UserMenu name={account.name} email={account.email} avatarUrl={account.avatarUrl} tier={account.tier} isStaff={account.isStaff} />
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
        <Link href="/auth">Connexion</Link>
      </Button>
      <Button asChild size="sm" className="bg-orange text-nuit hover:bg-orange/90">
        <Link href="/abonnement">S&apos;abonner</Link>
      </Button>
    </>
  )
}
