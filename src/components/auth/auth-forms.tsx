"use client"

import { useActionState, useState } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { requestPasswordReset, signIn, signUp } from "@/actions/auth"
import { initialActionState, type ActionState } from "@/actions/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

function FormMessage({ state }: { state: ActionState }) {
  if (!state.message) return null
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        state.status === "error" ? "bg-red-50 text-red-700" : "bg-vert-pale text-vert-fonce",
      )}
    >
      {state.message}
    </p>
  )
}

function PasswordInput({ id, autoComplete }: { id: string; autoComplete: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        name="password"
        type={visible ? "text" : "password"}
        required
        minLength={autoComplete === "new-password" ? 8 : undefined}
        maxLength={72}
        autoComplete={autoComplete}
        className="h-11 pr-11"
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-nuit"
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" disabled={pending} className="h-11 w-full bg-vert-fonce text-base hover:bg-vert-fonce/90">
      {pending && <Loader2 className="size-4 animate-spin" />} {children}
    </Button>
  )
}

export function AuthForms({ next, defaultTab }: { next: string; defaultTab: "connexion" | "inscription" }) {
  const [signInState, signInAction, signInPending] = useActionState(signIn, initialActionState)
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, initialActionState)
  const [resetState, resetAction, resetPending] = useActionState(requestPasswordReset, initialActionState)
  const [tab, setTab] = useState<string>(defaultTab)

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="grid h-11 w-full grid-cols-2">
        <TabsTrigger value="connexion">Connexion</TabsTrigger>
        <TabsTrigger value="inscription">Inscription</TabsTrigger>
      </TabsList>

      <TabsContent value="connexion" className="mt-6">
        <form action={signInAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <div className="space-y-2">
            <Label htmlFor="signin-email">Email</Label>
            <Input id="signin-email" name="email" type="email" required autoComplete="email" className="h-11" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="signin-password">Mot de passe</Label>
              <button type="button" onClick={() => setTab("oubli")} className="text-xs text-vert-emeraude hover:underline">
                Mot de passe oublié ?
              </button>
            </div>
            <PasswordInput id="signin-password" autoComplete="current-password" />
          </div>
          <FormMessage state={signInState} />
          <SubmitButton pending={signInPending}>Se connecter</SubmitButton>
        </form>
      </TabsContent>

      <TabsContent value="inscription" className="mt-6">
        <form action={signUpAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <div className="space-y-2">
            <Label htmlFor="signup-name">Nom complet</Label>
            <Input id="signup-name" name="fullName" required maxLength={120} autoComplete="name" className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-email">Email</Label>
            <Input id="signup-email" name="email" type="email" required autoComplete="email" className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-password">Mot de passe</Label>
            <PasswordInput id="signup-password" autoComplete="new-password" />
            <p className="text-xs text-muted-foreground">8 caractères minimum.</p>
          </div>
          <FormMessage state={signUpState} />
          <SubmitButton pending={signUpPending}>Créer mon compte</SubmitButton>
          <p className="text-center text-xs text-muted-foreground">
            En créant un compte, vous acceptez de recevoir nos emails de service. Vous pouvez vous
            désinscrire à tout moment.
          </p>
        </form>
      </TabsContent>

      <TabsContent value="oubli" className="mt-6">
        <form action={resetAction} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Indiquez votre email : nous vous enverrons un lien pour choisir un nouveau mot de passe.
          </p>
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input id="reset-email" name="email" type="email" required autoComplete="email" className="h-11" />
          </div>
          <FormMessage state={resetState} />
          <SubmitButton pending={resetPending}>Envoyer le lien</SubmitButton>
          <button type="button" onClick={() => setTab("connexion")} className="w-full text-center text-sm text-vert-emeraude hover:underline">
            Retour à la connexion
          </button>
        </form>
      </TabsContent>
    </Tabs>
  )
}
