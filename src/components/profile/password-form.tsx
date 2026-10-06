"use client"

import { useActionState } from "react"
import { Loader2 } from "lucide-react"
import { updatePassword } from "@/actions/auth"
import { initialActionState } from "@/actions/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, initialActionState)

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Nouveau mot de passe</Label>
        <Input id="password" name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className="h-11" />
      </div>
      {state.message && (
        <p role="status" className={state.status === "error" ? "text-sm text-red-600" : "text-sm text-vert-emeraude"}>
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-11 w-full bg-vert-fonce hover:bg-vert-fonce/90">
        {pending && <Loader2 className="size-4 animate-spin" />} Mettre à jour
      </Button>
    </form>
  )
}
