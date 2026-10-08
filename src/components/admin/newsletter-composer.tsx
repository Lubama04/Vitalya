"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { FlaskConical, Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import { sendNewsletter } from "@/actions/admin"
import { initialActionState } from "@/actions/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export type Audience = "tous" | "gratuits" | "premium" | "expert"
export type AudienceCounts = Record<Audience, number>

const AUDIENCES: { value: Audience; label: string; hint: string }[] = [
  { value: "tous", label: "Tous les inscrits", hint: "Toute la liste newsletter" },
  { value: "gratuits", label: "Gratuits", hint: "Sans abonnement payant (y compris sans compte)" },
  { value: "premium", label: "Premium", hint: "Abonnement Premium actif" },
  { value: "expert", label: "Expert", hint: "Abonnement Expert actif" },
]

export function NewsletterComposer({ counts, emailEnabled }: { counts: AudienceCounts; emailEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(sendNewsletter, initialActionState)
  const formRef = useRef<HTMLFormElement>(null)
  const [audience, setAudience] = useState<Audience>("tous")
  const subscribers = counts[audience]

  useEffect(() => {
    if (state.status === "success") toast.success(state.message)
    if (state.status === "error") toast.error(state.message)
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="space-y-5 rounded-2xl border bg-white p-6">
      {!emailEnabled && (
        <p className="rounded-xl bg-or/15 px-4 py-3 text-sm">
          Resend n&apos;est pas encore configuré (<code>RESEND_API_KEY</code>) : l&apos;envoi est désactivé.
        </p>
      )}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Audience</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCES.map((item) => (
            <label
              key={item.value}
              className="flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-sm transition-colors has-[:checked]:border-vert-emeraude has-[:checked]:bg-vert-pale/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-vert-emeraude"
            >
              <span className="flex items-center justify-between gap-2 font-medium">
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="audience"
                    value={item.value}
                    checked={audience === item.value}
                    onChange={() => setAudience(item.value)}
                    className="accent-vert-emeraude"
                  />
                  {item.label}
                </span>
                <span className="tabular-nums text-muted-foreground">{counts[item.value]}</span>
              </span>
              <span className="text-xs text-muted-foreground">{item.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor="subject">Objet</Label>
        <Input id="subject" name="subject" required maxLength={200} placeholder="Le secret de l'huile de baobab 🌿" className="h-11" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nl-content">Message</Label>
        <Textarea
          id="nl-content"
          name="content"
          required
          rows={14}
          placeholder={"Bonjour,\n\nCette semaine dans Vitalya…\n\n## Notre dossier\n\n**Huile de baobab** : [lire l'article](https://…)"}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Mise en forme : paragraphes séparés par une ligne vide, <code>## titre</code>, <code>**gras**</code>,{" "}
          <code>*italique*</code>, <code>[texte](https://lien)</code>. Bannière et lien de désinscription ajoutés automatiquement.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" name="mode" value="test" variant="outline" disabled={pending || !emailEnabled}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />} M&apos;envoyer un test
        </Button>
        <Button
          type="submit"
          name="mode"
          value="envoi"
          disabled={pending || !emailEnabled || subscribers === 0}
          className="bg-orange text-nuit hover:bg-orange/90"
          onClick={(event) => {
            if (!window.confirm(`Envoyer cette newsletter à ${subscribers} abonné·e·s ?`)) event.preventDefault()
          }}
        >
          <Send className="size-4" /> Envoyer à {subscribers} abonné·e·s
        </Button>
      </div>
    </form>
  )
}
