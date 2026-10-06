import type { ReactNode } from "react"
import { ImageOff } from "lucide-react"
import { isAllowedMediaUrl, parseYouTubeId } from "@/lib/mdx/urls"
import { cn } from "@/lib/utils"

// Composants médias : seules les URLs du stockage Vitalya sont rendues
// (les URLs externes sont ignorées, la CSP les bloquerait de toute façon).

function MediaRefused({ label }: { label: string }) {
  return (
    <p className="my-6 flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
      <ImageOff className="size-4" aria-hidden /> {label}
    </p>
  )
}

/** Image Markdown ![alt](url) : rendue uniquement si hébergée par Vitalya. */
export function SafeImage({ src, alt }: { src?: unknown; alt?: string }) {
  if (!isAllowedMediaUrl(src)) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt ?? ""} loading="lazy" decoding="async" className="my-8 w-full rounded-2xl" />
}

type FigureProps = { src?: string; alt?: string; legende?: string; credit?: string; taille?: string }

export function Figure({ src, alt, legende, credit, taille }: FigureProps) {
  if (!isAllowedMediaUrl(src)) return <MediaRefused label="Image indisponible (source non autorisée)." />
  const large = taille === "large" || taille === "pleine"
  return (
    <figure className={cn("my-10", large && "lg:-mx-24", taille === "pleine" && "pleine-largeur lg:mx-0")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt ?? ""} loading="lazy" decoding="async" className={cn("w-full", taille !== "pleine" && "rounded-2xl")} />
      {(legende || credit) && (
        <figcaption className="mx-auto mt-3 max-w-3xl px-4 text-center text-sm text-muted-foreground sm:px-0">
          {legende}
          {credit && <span className="ml-1 text-xs opacity-75">© {credit}</span>}
        </figcaption>
      )}
    </figure>
  )
}

/** Infographie : grande image + légende (lisible en pleine taille). */
export function Infographie(props: FigureProps) {
  return <Figure {...props} taille="large" />
}

type GalleryImage = { src: string; alt?: string; legende?: string }

function parseImages(raw: string | undefined): GalleryImage[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item): GalleryImage | null => {
        if (typeof item === "string") return { src: item }
        if (item && typeof item === "object" && "src" in item && typeof item.src === "string") {
          const record = item as Record<string, unknown>
          return {
            src: item.src,
            alt: typeof record.alt === "string" ? record.alt : undefined,
            legende: typeof record.legende === "string" ? record.legende : undefined,
          }
        }
        return null
      })
      .filter((item): item is GalleryImage => item !== null && isAllowedMediaUrl(item.src))
      .slice(0, 24)
  } catch {
    return []
  }
}

export function Galerie({ images, legende }: { images?: string; legende?: string }) {
  const items = parseImages(images)
  if (items.length === 0) return <MediaRefused label="Galerie vide ou images non autorisées." />
  return (
    <figure className="my-10 lg:-mx-16">
      <div className={cn("grid gap-3", items.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
        {items.map((image, index) => (
          <div key={`${image.src}-${index}`} className={cn("group relative overflow-hidden rounded-xl", items.length >= 5 && index === 0 && "sm:col-span-2 sm:row-span-2")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.src} alt={image.alt ?? ""} loading="lazy" decoding="async" className="aspect-square size-full object-cover transition-transform duration-500 group-hover:scale-105" />
            {image.legende && (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-nuit/80 to-transparent px-3 pt-6 pb-2 text-xs text-white">
                {image.legende}
              </span>
            )}
          </div>
        ))}
      </div>
      {legende && <figcaption className="mt-3 text-center text-sm text-muted-foreground">{legende}</figcaption>}
    </figure>
  )
}

export function Video({ src, poster, titre }: { src?: string; poster?: string; titre?: string }) {
  if (!isAllowedMediaUrl(src)) return <MediaRefused label="Vidéo indisponible (source non autorisée)." />
  return (
    <figure className="my-10">
      <video
        controls
        preload="metadata"
        playsInline
        poster={isAllowedMediaUrl(poster) ? poster : undefined}
        className="aspect-video w-full rounded-2xl bg-nuit"
        aria-label={titre ?? "Vidéo"}
      >
        <source src={src} type={src.toLowerCase().endsWith(".webm") ? "video/webm" : "video/mp4"} />
        Votre navigateur ne peut pas lire cette vidéo.
      </video>
      {titre && <figcaption className="mt-3 text-center text-sm text-muted-foreground">{titre}</figcaption>}
    </figure>
  )
}

/** Vidéo YouTube en mode « confidentialité renforcée » (youtube-nocookie). */
export function YouTube({ videoId, titre }: { videoId?: string; titre?: string }) {
  const id = videoId ? parseYouTubeId(videoId) : null
  if (!id) return <MediaRefused label="Vidéo YouTube invalide." />
  return (
    <figure className="my-10">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-nuit">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?rel=0`}
          title={titre ?? "Vidéo YouTube"}
          loading="lazy"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          className="absolute inset-0 size-full border-0"
        />
      </div>
      {titre && <figcaption className="mt-3 text-center text-sm text-muted-foreground">{titre}</figcaption>}
    </figure>
  )
}

/** Bloc image + texte, 4 variantes de mise en page. */
export function MediaText({
  src,
  alt,
  variante,
  legende,
  children,
}: {
  src?: string
  alt?: string
  variante?: string
  legende?: string
  children?: ReactNode
}) {
  if (!isAllowedMediaUrl(src)) return <div>{children}</div>
  // eslint-disable-next-line @next/next/no-img-element
  const image = <img src={src} alt={alt ?? ""} loading="lazy" decoding="async" className="size-full rounded-2xl object-cover" />
  const text = <div className="space-y-4 [&>*:first-child]:mt-0">{children}</div>

  if (variante === "image-fond") {
    return (
      <section className="pleine-largeur relative my-14 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt ?? ""} loading="lazy" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-nuit/65" />
        <div className="relative mx-auto max-w-3xl space-y-4 px-4 py-20 text-white sm:px-6 [&_h2]:text-white [&_h3]:text-or [&_strong]:text-or">
          {children}
        </div>
      </section>
    )
  }
  if (variante === "image-dessous") {
    return (
      <section className="my-10 space-y-6">
        {text}
        <figure>
          <div className="aspect-[16/9]">{image}</div>
          {legende && <figcaption className="mt-2 text-center text-sm text-muted-foreground">{legende}</figcaption>}
        </figure>
      </section>
    )
  }
  const imageFirst = variante !== "texte-image"
  return (
    <section className="my-12 grid items-center gap-8 md:grid-cols-2 lg:-mx-16">
      <figure className={cn("aspect-[4/5]", !imageFirst && "md:order-2")}>
        {image}
        {legende && <figcaption className="mt-2 text-center text-sm text-muted-foreground">{legende}</figcaption>}
      </figure>
      {text}
    </section>
  )
}

/** Grand visuel pleine largeur avec titre en surimpression. */
export function HeroSection({
  src,
  titre,
  sousTitre,
  children,
}: {
  src?: string
  titre?: string
  sousTitre?: string
  children?: ReactNode
}) {
  return (
    <section className="pleine-largeur relative my-16 flex min-h-[min(60vh,640px)] items-end overflow-hidden bg-vert-fonce text-white">
      {isAllowedMediaUrl(src) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-nuit via-nuit/50 to-transparent" />
      <div className="relative mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
        {titre && <p className="m-0 font-heading text-4xl leading-tight font-bold sm:text-5xl">{titre}</p>}
        {sousTitre && <p className="mt-3 font-heading text-xl text-white/85 italic">{sousTitre}</p>}
        {children && <div className="mt-4 text-white/90 [&_p]:m-0">{children}</div>}
      </div>
    </section>
  )
}
