import Image from "next/image"
import Link from "next/link"
import { Clock } from "lucide-react"
import { AccessBadge } from "@/components/article/access-badge"
import { accentOnWhite, formatDate } from "@/lib/constants"
import type { ArticleSummary } from "@/lib/data"
import { cn } from "@/lib/utils"

type ArticleCardProps = {
  article: ArticleSummary
  variant?: "default" | "featured" | "compact"
  priority?: boolean
}

export function ArticleCard({ article, variant = "default", priority = false }: ArticleCardProps) {
  const featured = variant === "featured"
  const compact = variant === "compact"

  return (
    <article
      className={cn(
        "group relative flex overflow-hidden rounded-2xl bg-white",
        featured ? "flex-col lg:flex-row" : compact ? "flex-row gap-4" : "flex-col",
      )}
    >
      <div
        className={cn(
          "relative shrink-0 overflow-hidden bg-vert-pale",
          featured ? "aspect-[16/10] lg:aspect-auto lg:w-3/5" : compact ? "size-24 rounded-xl" : "aspect-[16/10] rounded-2xl",
        )}
      >
        {article.coverImage ? (
          <Image
            src={article.coverImage}
            alt=""
            fill
            priority={priority}
            sizes={featured ? "(max-width: 1024px) 100vw, 60vw" : compact ? "96px" : "(max-width: 768px) 100vw, 33vw"}
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-heading text-3xl text-vert-fonce/30">V</div>
        )}
        {!compact && (
          <div className="absolute top-3 left-3">
            <AccessBadge level={article.accessLevel} />
          </div>
        )}
      </div>

      <div className={cn("flex flex-1 flex-col", featured ? "justify-center p-6 lg:p-10" : compact ? "py-1" : "pt-4")}>
        {article.category && (
          <Link
            href={`/categories/${article.category.slug}`}
            className="relative z-10 mb-2 w-fit text-xs font-semibold tracking-wider uppercase hover:underline"
            style={{ color: accentOnWhite(article.category.color) }}
          >
            {article.category.name}
          </Link>
        )}
        <h3
          className={cn(
            "font-heading leading-tight font-bold text-nuit transition-colors group-hover:text-vert-fonce",
            featured ? "text-3xl lg:text-4xl" : compact ? "text-base" : "text-xl",
          )}
        >
          <Link href={`/articles/${article.slug}`} className="after:absolute after:inset-0">
            {article.title}
          </Link>
        </h3>
        {article.subtitle && !compact && (
          <p className={cn("mt-2 line-clamp-3 text-muted-foreground", featured ? "text-lg" : "text-sm")}>
            {article.subtitle}
          </p>
        )}
        <p className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <time dateTime={article.publishedAt ?? undefined}>{formatDate(article.publishedAt)}</time>
          <span className="flex items-center gap-1">
            <Clock className="size-3" aria-hidden /> {article.readingTime} min
          </span>
        </p>
      </div>
    </article>
  )
}
