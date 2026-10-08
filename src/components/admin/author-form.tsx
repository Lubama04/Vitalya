"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { ImagePlus, Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { saveAuthor } from "@/actions/admin"
import { initialActionState } from "@/actions/types"
import { uploadMedia } from "@/components/admin/editor/upload"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export type EditableAuthor = {
  id?: string
  name: string
  specialty: string
  bio: string
  email: string
  photoUrl: string
}

export function AuthorForm({ author, onDone }: { author: EditableAuthor; onDone?: () => void }) {
  const [state, formAction, pending] = useActionState(saveAuthor, initialActionState)
  const [photoUrl, setPhotoUrl] = useState(author.photoUrl)
  const [uploading, setUploading] = useState(false)
  const [bio, setBio] = useState(author.bio)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message)
      if (!author.id) {
        formRef.current?.reset()
        setPhotoUrl("")
        setBio("")
      }
      onDone?.()
    }
    if (state.status === "error") toast.error(state.message)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  async function onPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setUploading(true)
    try {
      setPhotoUrl(await uploadMedia(file, "image"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import impossible.")
    } finally {
      setUploading(false)
    }
  }

  const prefix = author.id ?? "nouveau"

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {author.id && <input type="hidden" name="id" value={author.id} />}
      <input type="hidden" name="photoUrl" value={photoUrl} />

      <div className="flex items-center gap-4">
        <div className="size-16 shrink-0 overflow-hidden rounded-full bg-vert-pale">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photoUrl && <img src={photoUrl} alt="" className="size-full object-cover" />}
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm font-medium hover:bg-vert-pale">
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          {photoUrl ? "Changer la photo" : "Ajouter une photo"}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={onPhoto} className="sr-only" disabled={uploading} />
        </label>
        {photoUrl && (
          <button type="button" onClick={() => setPhotoUrl("")} className="text-xs text-red-600 hover:underline">
            Retirer
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-name`}>Nom</Label>
          <Input id={`${prefix}-name`} name="name" defaultValue={author.name} required maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-specialty`}>Spécialité</Label>
          <Input id={`${prefix}-specialty`} name="specialty" defaultValue={author.specialty} maxLength={120} placeholder="Dermatologue, nutritionniste…" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-bio`}>Bio courte</Label>
        <Textarea id={`${prefix}-bio`} name="bio" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={400} rows={3} />
        <p className="text-right text-xs text-muted-foreground">{bio.length}/400</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-email`}>Email (privé, jamais affiché)</Label>
        <Input id={`${prefix}-email`} name="email" type="email" defaultValue={author.email} maxLength={254} />
      </div>
      <Button type="submit" disabled={pending || uploading} className="bg-vert-fonce hover:bg-vert-fonce/90">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {author.id ? "Enregistrer" : "Ajouter l'auteur"}
      </Button>
    </form>
  )
}
