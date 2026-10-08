import { ImageResponse } from "next/og"
import sharp from "sharp"
import { siteUrl } from "@/lib/env"
import { createPublicClient } from "@/lib/supabase/public"

// Image de partage (Open Graph / Twitter) générée par article : titre, rubrique, couverture
export const alt = "Article Vitalya"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const revalidate = 3600
export const runtime = "nodejs"

/**
 * Couverture convertie en JPEG (le moteur de rendu ne lit pas le WebP / AVIF).
 * En cas d'échec, l'image de partage est produite sans photo.
 */
async function loadCover(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!response.ok) return null
    const jpeg = await sharp(Buffer.from(await response.arrayBuffer()))
      .resize(500, 630, { fit: "cover" })
      .jpeg({ quality: 80 })
      .toBuffer()
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`
  } catch {
    return null
  }
}

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { data: article } = await createPublicClient()
    .from("articles")
    .select("title, cover_image, access_level, category:categories(name, color)")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle()
    .overrideTypes<
      { title: string; cover_image: string | null; access_level: string; category: { name: string; color: string } | null },
      { merge: false }
    >()

  const title = article?.title ?? "Vitalya"
  const coverUrl = article?.cover_image
    ? article.cover_image.startsWith("http")
      ? article.cover_image
      : `${siteUrl}${article.cover_image}`
    : null
  const cover = coverUrl ? await loadCover(coverUrl) : null

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0D6B4A", fontFamily: "Georgia, serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: cover ? 700 : 1200, padding: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, color: "#F4B942", fontSize: 28, letterSpacing: 6 }}>
            VITALYA
            <span style={{ color: "#D6F0E6", fontSize: 18, letterSpacing: 3 }}>SANTÉ · BEAUTÉ · BIEN-ÊTRE</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {article?.category && (
              <div style={{ display: "flex", color: "#E8813A", fontSize: 26, letterSpacing: 4, textTransform: "uppercase" }}>
                {article.category.name}
              </div>
            )}
            <div style={{ display: "flex", color: "#FFFFFF", fontSize: title.length > 60 ? 52 : 64, lineHeight: 1.1, fontWeight: 700 }}>
              {title}
            </div>
          </div>
          <div style={{ display: "flex", color: "#D6F0E6", fontSize: 24, fontStyle: "italic" }}>Vivre mieux, naturellement.</div>
        </div>
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" width={500} height={630} style={{ width: 500, height: 630, objectFit: "cover" }} />
        )}
      </div>
    ),
    size,
  )
}
