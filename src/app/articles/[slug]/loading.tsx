import { Skeleton } from "@/components/ui/skeleton"

export default function ArticleLoading() {
  return (
    <div aria-busy="true" aria-label="Chargement de l'article">
      <Skeleton className="h-[min(72vh,760px)] w-full rounded-none" />
      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-12 sm:px-6">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-5 w-full" />
        ))}
      </div>
    </div>
  )
}
