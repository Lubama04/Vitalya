"use client"

import Link from "next/link"
import { LayoutDashboard, LogOut, Sparkles, User } from "lucide-react"
import { signOut } from "@/actions/auth"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ACCESS_LABELS, type AccessLevel } from "@/lib/constants"

type UserMenuProps = {
  name: string
  email: string
  avatarUrl: string | null
  tier: AccessLevel
  isStaff: boolean
}

function initials(name: string): string {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function UserMenu({ name, email, avatarUrl, tier, isStaff }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 rounded-full px-1.5 sm:pr-3" aria-label="Mon compte">
          <Avatar className="size-8 border border-vert-pale">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
            <AvatarFallback className="bg-vert-fonce text-xs text-white">{initials(name)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
          <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-vert-pale px-2 py-0.5 text-xs font-medium text-vert-fonce">
            <Sparkles className="size-3" aria-hidden /> {ACCESS_LABELS[tier]}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profil"><User className="size-4" /> Mon espace</Link>
        </DropdownMenuItem>
        {tier === "free" && (
          <DropdownMenuItem asChild>
            <Link href="/abonnement"><Sparkles className="size-4" /> Passer Premium</Link>
          </DropdownMenuItem>
        )}
        {isStaff && (
          <DropdownMenuItem asChild>
            <Link href="/admin"><LayoutDashboard className="size-4" /> Back-office</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut className="size-4" /> Se déconnecter
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
