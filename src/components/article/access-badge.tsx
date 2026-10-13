import { Crown, Gem, Leaf } from "lucide-react"
import { ACCESS_LABELS, type AccessLevel } from "@/lib/constants"
import { cn } from "@/lib/utils"

const STYLES: Record<AccessLevel, string> = {
  free: "bg-vert-fonce text-white",
  premium: "bg-or text-nuit",
  expert: "bg-nuit text-or",
}

const ICONS = { free: Leaf, premium: Crown, expert: Gem } as const

/** Badge d'accès : Gratuit (vert), Premium (or), Expert (noir). */
export function AccessBadge({ level, className, size = "md" }: { level: AccessLevel; className?: string; size?: "sm" | "md" }) {
  const Icon = ICONS[level]
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full font-semibold tracking-wide whitespace-nowrap uppercase shadow-sm",
        size === "sm" ? "px-2 py-0.5 text-[0.62rem]" : "px-2.5 py-1 text-[0.7rem]",
        STYLES[level],
        className,
      )}
    >
      <Icon className={size === "sm" ? "size-2.5" : "size-3"} aria-hidden />
      {ACCESS_LABELS[level]}
    </span>
  )
}
