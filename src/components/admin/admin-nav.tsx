"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, FileText, Mail, PenLine, Users } from "lucide-react"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/admin", label: "Statistiques", icon: BarChart3 },
  { href: "/admin/articles", label: "Articles", icon: FileText },
  { href: "/admin/auteurs", label: "Auteurs", icon: PenLine },
  { href: "/admin/abonnes", label: "Abonnés", icon: Users },
  { href: "/admin/newsletter", label: "Newsletter", icon: Mail },
] as const

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Back-office" className="flex gap-1 overflow-x-auto lg:flex-col">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-vert-fonce text-white" : "text-nuit/75 hover:bg-vert-pale hover:text-vert-fonce",
            )}
          >
            <Icon className="size-4" aria-hidden /> {label}
          </Link>
        )
      })}
    </nav>
  )
}
