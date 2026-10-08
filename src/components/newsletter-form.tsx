"use client"

import { useActionState, useEffect, useRef } from "react"
import { Loader2, Send } from "lucide-react"
import { subscribeToNewsletter } from "@/actions/newsletter"
import { initialActionState } from "@/actions/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function NewsletterForm({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [state, formAction, pending] = useActionState(subscribeToNewsletter, initialActionState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="w-full" noValidate>
      <div className="flex gap-2">
        <label htmlFor={`newsletter-email-${variant}`} className="sr-only">Adresse email</label>
        <Input
          id={`newsletter-email-${variant}`}
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="votre@email.com"
          className={cn(
            "h-11",
            variant === "dark" && "border-white/20 bg-white/10 text-white placeholder:text-white/40",
          )}
        />
        {/* Champ piège anti-robots, invisible pour les humains */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        <Button type="submit" disabled={pending} className="h-11 shrink-0 bg-orange text-nuit hover:bg-orange/90">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          <span className="sr-only sm:not-sr-only">S&apos;inscrire</span>
        </Button>
      </div>
      {state.message && (
        <p
          role="status"
          className={cn(
            "mt-2 text-sm",
            state.status === "error" ? "text-red-400" : variant === "dark" ? "text-or" : "text-vert-emeraude",
          )}
        >
          {state.message}
        </p>
      )}
    </form>
  )
}
