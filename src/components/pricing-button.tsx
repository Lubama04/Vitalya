"use client"

import { useActionState } from "react"
import { Loader2 } from "lucide-react"
import { startCheckout } from "@/actions/billing"
import { initialActionState } from "@/actions/types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function PricingButton({
  tier,
  label,
  highlighted,
}: {
  tier: "premium" | "expert"
  label: string
  highlighted?: boolean
}) {
  const [state, formAction, pending] = useActionState(startCheckout, initialActionState)

  return (
    <form action={formAction} className="w-full">
      <input type="hidden" name="tier" value={tier} />
      <Button
        type="submit"
        disabled={pending}
        size="lg"
        className={cn(
          "h-12 w-full text-base",
          highlighted ? "bg-orange text-nuit hover:bg-orange/90" : "bg-vert-fonce hover:bg-vert-fonce/90",
        )}
      >
        {pending && <Loader2 className="size-4 animate-spin" />} {label}
      </Button>
      {state.message && (
        <p role="status" className="mt-3 text-center text-sm text-muted-foreground">{state.message}</p>
      )}
    </form>
  )
}
