import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { publicEnv } from "@/lib/env"
import type { Database } from "@/types/database"

// Routes nécessitant une session
const PROTECTED_PREFIXES = ["/profil", "/admin"]

/** Rafraîchit la session Supabase et protège les routes privées. */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )

  // Visiteur sans cookie de session Supabase : rien à rafraîchir, aucun appel réseau
  const hasSessionCookie = request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-"))
  if (!hasSessionCookie) {
    if (!isProtected) return NextResponse.next({ request })
    const url = request.nextUrl.clone()
    url.pathname = "/auth"
    url.search = ""
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getUser() valide le jeton auprès de Supabase (ne pas remplacer par getSession()).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth"
    url.search = ""
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  return response
}
