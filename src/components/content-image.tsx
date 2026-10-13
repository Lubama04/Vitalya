import Image, { type ImageProps } from "next/image"
import { isOptimizableImage } from "@/lib/mdx/urls"

/**
 * Image de contenu (couvertures, images d'articles, photos d'auteurs).
 * Les sources connues (fichiers du site, stockage Vitalya, Unsplash) passent par l'optimiseur
 * Next.js (AVIF / WebP, tailles adaptées) ; toute autre URL https est affichée telle quelle.
 */
export function ContentImage({ src, alt, unoptimized, ...props }: ImageProps) {
  const external = typeof src === "string" && !isOptimizableImage(src)
  return <Image src={src} alt={alt} unoptimized={unoptimized ?? external} {...props} />
}
