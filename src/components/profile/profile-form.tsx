"use client"

import { useActionState } from "react"
import { Loader2 } from "lucide-react"
import { updateProfile } from "@/actions/profile"
import { initialActionState } from "@/actions/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const [state, formAction, pending] = useActionState(updateProfile, initialActionState)

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">Nom complet</Label>
        <Input id="fullName" name="fullName" defaultValue={fullName} required maxLength={120} className="h-11" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled readOnly className="h-11" />
      </div>
      {state.message && (
        <p role="status" className={state.status === "error" ? "text-sm text-red-600" : "text-sm text-vert-emeraude"}>
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="bg-vert-fonce hover:bg-vert-fonce/90">
        {pending && <Loader2 className="size-4 animate-spin" />} Enregistrer
      </Button>
    </form>
  )
}
