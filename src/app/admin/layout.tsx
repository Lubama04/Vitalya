import type { Metadata } from "next"
import { AdminNav } from "@/components/admin/admin-nav"
import { requireStaff } from "@/lib/auth"
import { ROLE_LABELS } from "@/lib/constants"

export const metadata: Metadata = {
  title: { default: "Back-office", template: "%s · Back-office Vitalya" },
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Vérification serveur du rôle : aucun contenu admin n'est rendu sinon
  const viewer = await requireStaff()

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[220px_1fr]">
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <p className="mb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Back-office</p>
        <p className="mb-5 truncate text-sm">
          {viewer.fullName ?? viewer.email} · <span className="text-vert-emeraude">{ROLE_LABELS[viewer.role]}</span>
        </p>
        <AdminNav />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
