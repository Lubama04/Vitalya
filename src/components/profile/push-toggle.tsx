"use client"

import { useEffect, useState } from "react"
import { Bell, BellOff } from "lucide-react"
import { toast } from "sonner"
import { deletePushSubscription, savePushSubscription } from "@/actions/profile"
import { Button } from "@/components/ui/button"

/** Convertit la clé publique VAPID (base64url) en tableau d'octets. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"))
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index)
  return output
}

type Status = "unsupported" | "unconfigured" | "idle" | "subscribed" | "denied"

export function PushToggle({ vapidPublicKey }: { vapidPublicKey?: string }) {
  const [status, setStatus] = useState<Status>("idle")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setStatus("unsupported")
      return
    }
    if (!vapidPublicKey) {
      setStatus("unconfigured")
      return
    }
    if (Notification.permission === "denied") {
      setStatus("denied")
      return
    }
    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setStatus(subscription ? "subscribed" : "idle"))
  }, [vapidPublicKey])

  async function subscribe() {
    if (!vapidPublicKey) return
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "idle")
        return
      }
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })
      const result = await savePushSubscription(subscription.toJSON())
      if (!result.ok) throw new Error("save")
      setStatus("subscribed")
      toast.success("Notifications activées")
    } catch {
      toast.error("Activation des notifications impossible.")
    } finally {
      setBusy(false)
    }
  }

  async function unsubscribe() {
    setBusy(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await deletePushSubscription(subscription.endpoint)
        await subscription.unsubscribe()
      }
      setStatus("idle")
      toast.success("Notifications désactivées")
    } finally {
      setBusy(false)
    }
  }

  if (status === "unsupported") {
    return <p className="text-sm text-muted-foreground">Votre navigateur ne prend pas en charge les notifications.</p>
  }
  if (status === "unconfigured") {
    return <p className="text-sm text-muted-foreground">Les notifications push arrivent bientôt.</p>
  }
  if (status === "denied") {
    return (
      <p className="text-sm text-muted-foreground">
        Notifications bloquées : autorisez-les dans les réglages de votre navigateur.
      </p>
    )
  }

  return status === "subscribed" ? (
    <Button type="button" variant="outline" onClick={unsubscribe} disabled={busy}>
      <BellOff className="size-4" /> Désactiver les notifications
    </Button>
  ) : (
    <Button type="button" variant="outline" onClick={subscribe} disabled={busy}>
      <Bell className="size-4" /> Activer les notifications
    </Button>
  )
}
