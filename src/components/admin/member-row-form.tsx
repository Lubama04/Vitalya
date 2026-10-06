"use client"

import { useActionState, useEffect } from "react"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { updateMember } from "@/actions/admin"
import { initialActionState } from "@/actions/types"
import { Button } from "@/components/ui/button"
import { ACCESS_LABELS, ACCESS_LEVELS, ROLE_LABELS, ROLES, type AccessLevel, type Role } from "@/lib/constants"

export function MemberRowForm({ userId, role, tier }: { userId: string; role: Role; tier: AccessLevel }) {
  const [state, formAction, pending] = useActionState(updateMember, initialActionState)

  useEffect(() => {
    if (state.status === "success") toast.success(state.message)
    if (state.status === "error") toast.error(state.message)
  }, [state])

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <label className="sr-only" htmlFor={`tier-${userId}`}>Formule</label>
      <select id={`tier-${userId}`} name="tier" defaultValue={tier} className="h-9 rounded-md border bg-white px-2 text-sm">
        {ACCESS_LEVELS.map((level) => (
          <option key={level} value={level}>{ACCESS_LABELS[level]}</option>
        ))}
      </select>
      <label className="sr-only" htmlFor={`role-${userId}`}>Rôle</label>
      <select id={`role-${userId}`} name="role" defaultValue={role} className="h-9 rounded-md border bg-white px-2 text-sm">
        {ROLES.map((item) => (
          <option key={item} value={item}>{ROLE_LABELS[item]}</option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline" disabled={pending} aria-label="Enregistrer">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
      </Button>
    </form>
  )
}
