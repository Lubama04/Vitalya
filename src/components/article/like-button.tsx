"use client"

import { useOptimistic, useState, useTransition } from "react"
import Link from "next/link"
import { Heart } from "lucide-react"
import { toast } from "sonner"
import { toggleLike } from "@/actions/engagement"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type LikeState = { liked: boolean; count: number }

export function LikeButton({
  articleId,
  initial,
  isAuthenticated,
}: {
  articleId: string
  initial: LikeState
  isAuthenticated: boolean
}) {
  const [state, setState] = useState(initial)
  const [optimistic, setOptimistic] = useOptimistic(state)
  const [pending, startTransition] = useTransition()

  if (!isAuthenticated) {
    return (
      <Button asChild variant="outline" className="rounded-full">
        <Link href="/auth">
          <Heart className="size-4" /> {initial.count} · J&apos;aime
        </Link>
      </Button>
    )
  }

  function handleClick() {
    startTransition(async () => {
      setOptimistic({
        liked: !optimistic.liked,
        count: optimistic.count + (optimistic.liked ? -1 : 1),
      })
      const result = await toggleLike(articleId)
      if (result.ok) setState(result.data)
      else toast.error(result.error)
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={optimistic.liked}
      className={cn("rounded-full", optimistic.liked && "border-orange/40 bg-orange/10 text-orange-fonce hover:bg-orange/15 hover:text-orange-fonce")}
    >
      <Heart className={cn("size-4 transition-transform", optimistic.liked && "scale-110 fill-orange")} />
      {optimistic.count} · J&apos;aime
    </Button>
  )
}
