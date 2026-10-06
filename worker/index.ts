// Worker personnalisé fusionné dans le service worker par next-pwa.
// Notifications push (préparées) : affichage et ouverture de l'article ciblé.

type PushPayload = { title?: string; body?: string; url?: string; tag?: string }

type ExtendableEventLike = Event & { waitUntil(promise: Promise<unknown>): void }
type PushEventLike = ExtendableEventLike & { data: { json(): unknown } | null }
type NotificationEventLike = ExtendableEventLike & { notification: Notification }
type WindowClientLike = { url: string; focus(): Promise<unknown>; navigate(url: string): Promise<unknown> }

type ServiceWorkerScope = {
  registration: ServiceWorkerRegistration
  location: Location
  clients: {
    matchAll(options: { type: "window"; includeUncontrolled: boolean }): Promise<WindowClientLike[]>
    openWindow(url: string): Promise<unknown>
  }
  addEventListener(type: "push", listener: (event: PushEventLike) => void): void
  addEventListener(type: "notificationclick", listener: (event: NotificationEventLike) => void): void
}

const sw = self as unknown as ServiceWorkerScope

function parsePayload(event: PushEventLike): PushPayload {
  try {
    const data = event.data?.json()
    return typeof data === "object" && data !== null ? (data as PushPayload) : {}
  } catch {
    return {}
  }
}

/** N'accepte que des chemins internes au site. */
function safeUrl(url: string | undefined): string {
  return url && url.startsWith("/") && !url.startsWith("//") ? url : "/"
}

sw.addEventListener("push", (event) => {
  const payload = parsePayload(event)
  event.waitUntil(
    sw.registration.showNotification(payload.title ?? "Vitalya", {
      body: payload.body ?? "Un nouvel article vous attend.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-96.png",
      tag: payload.tag ?? "vitalya",
      data: { url: safeUrl(payload.url) },
    }),
  )
})

sw.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const data = event.notification.data as { url?: string } | null
  const target = new URL(safeUrl(data?.url), sw.location.origin).href

  event.waitUntil(
    sw.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => client.url.startsWith(sw.location.origin))
      if (existing) return existing.navigate(target).then(() => existing.focus())
      return sw.clients.openWindow(target)
    }),
  )
})

export {}
