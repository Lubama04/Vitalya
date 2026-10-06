"use client"

import { useActionState, useEffect, useRef } from "react"
import { FlaskConical, Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import { sendNewsletter } from "@/actions/admin"
import { initialActionState } from "@/actions/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function NewsletterComposer({ subscribers, emailEnabled }: { subscribers: number; emailEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(sendNewsletter, initialActionState)
  const formRef = useRef<HTMLFormElement>(null)

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
          className="bg-orange text-white hover:bg-orange/90"
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
