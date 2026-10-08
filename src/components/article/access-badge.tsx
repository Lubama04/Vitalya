import { Crown, Gem } from "lucide-react"
import { ACCESS_LABELS, type AccessLevel } from "@/lib/constants"
import { cn } from "@/lib/utils"

/** Badge Premium / Expert (rien pour les articles gratuits). */
export function AccessBadge({ level, className }: { level: AccessLevel; className?: string }) {
  if (level === "free") return null
  const Icon = level === "expert" ? Gem : Crown
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold tracking-wide uppercase shadow-sm",
        level === "expert" ? "bg-nuit text-or" : "bg-or text-nuit",
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {ACCESS_LABELS[level]}
    </span>
  )
}
