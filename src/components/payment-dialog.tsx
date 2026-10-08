"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { CreditCard, Loader2, Lock, Smartphone } from "lucide-react"
import { listPawapayOperators, startPayment } from "@/actions/payments"
import { initialActionState } from "@/actions/types"
import { PaymentBadges } from "@/components/payment-badges"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatFcfa } from "@/lib/constants"
import { cn } from "@/lib/utils"

type Country = "TCD" | "CMR"
type Operator = { code: string; name: string }

const COUNTRIES: { code: Country; label: string; dial: string; example: string }[] = [
  { code: "TCD", label: "Tchad", dial: "+235", example: "66 12 34 56" },
  { code: "CMR", label: "Cameroun", dial: "+237", example: "6 71 23 45 67" },
]

/**
 * « Choisir Premium / Expert » : montant, numéro, opérateur, puis
 * « Payer par Mobile Money » (PawaPay, bascule automatique sur MoneyFusion)
 * ou « Payer par carte bancaire » (MoneyFusion : Visa, Mastercard, Wave).
 */
export function PaymentDialog({
  tier,
  tierName,
  priceEur,
  priceFcfa,
  label,
  highlighted,
  isAuthenticated,
}: {
  tier: "premium" | "expert"
  tierName: string
  priceEur: number
  priceFcfa: number
  label: string
  highlighted?: boolean
  isAuthenticated: boolean
}) {
  const buttonClass = cn(
    "h-12 w-full text-base",
    highlighted ? "bg-orange text-nuit hover:bg-orange/90" : "bg-vert-fonce hover:bg-vert-fonce/90",
  )

  if (!isAuthenticated) {
    return (
      <Button asChild size="lg" className={buttonClass}>
        <Link href="/auth?mode=inscription&next=/abonnement">{label}</Link>
      </Button>
    )
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="lg" className={buttonClass}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">Abonnement {tierName}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-heading text-3xl font-bold text-nuit">{priceEur} €</span>
            <span>soit {formatFcfa(priceFcfa)} · 1 mois d&apos;accès, sans renouvellement automatique</span>
          </DialogDescription>
        </DialogHeader>
        <PaymentForm tier={tier} />
      </DialogContent>
    </Dialog>
  )
}

function PaymentForm({ tier }: { tier: "premium" | "expert" }) {
  const [state, formAction, pending] = useActionState(startPayment, initialActionState)
  const [country, setCountry] = useState<Country>("TCD")
  const [operators, setOperators] = useState<Operator[] | null>(null)
  const [loading, startLoading] = useTransition()
  const [submitted, setSubmitted] = useState<"mobile" | "card" | null>(null)

  // Opérateurs ouverts pour le pays choisi (configuration PawaPay en direct)
  useEffect(() => {
    let cancelled = false
    setOperators(null)
    startLoading(async () => {
      const list = await listPawapayOperators(country)
      if (!cancelled) setOperators(list)
    })
    return () => {
      cancelled = true
    }
  }, [country])

  const current = COUNTRIES.find((item) => item.code === country) ?? COUNTRIES[0]

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="tier" value={tier} />

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Pays">
        {COUNTRIES.map((item) => (
          <label
            key={item.code}
            className={cn(
              "flex cursor-pointer items-center justify-center rounded-xl border p-2.5 text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-vert-emeraude",
              country === item.code && "border-vert-emeraude bg-vert-pale/50",
            )}
          >
            <input type="radio" name="country" value={item.code} checked={country === item.code} onChange={() => setCountry(item.code)} className="sr-only" />
            {item.label}
          </label>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="paiement-telephone">Numéro de téléphone</Label>
        <div className="flex">
          <span className="inline-flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">{current.dial}</span>
          <Input
            id="paiement-telephone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            required
            placeholder={current.example}
            className="h-11 rounded-l-none"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="paiement-operateur">Opérateur Mobile Money</Label>
        <select
          id="paiement-operateur"
          name="operator"
          required
          disabled={loading || !operators?.length}
          className="h-11 w-full rounded-md border border-input bg-white px-3 text-sm focus-visible:ring-2 focus-visible:ring-vert-emeraude focus-visible:outline-none disabled:opacity-60"
          defaultValue=""
          key={country}
        >
          <option value="" disabled>
            {loading || operators === null ? "Chargement des opérateurs…" : operators.length ? "Choisissez votre opérateur" : "Aucun opérateur disponible"}
          </option>
          {operators?.map((operator) => (
            <option key={operator.code} value={operator.code}>
              {operator.name}
            </option>
          ))}
        </select>
      </div>

      {state.status === "error" && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}

      <div className="grid gap-2 pt-1">
        <Button
          type="submit"
          name="method"
          value="mobile"
          disabled={pending}
          onClick={() => setSubmitted("mobile")}
          className="h-12 w-full bg-orange text-base text-nuit hover:bg-orange/90"
        >
          {pending && submitted === "mobile" ? <Loader2 className="size-4 animate-spin" /> : <Smartphone className="size-4" />}
          Payer par Mobile Money
        </Button>
        <Button
          type="submit"
          name="method"
          value="card"
          formNoValidate
          disabled={pending}
          onClick={() => setSubmitted("card")}
          variant="outline"
          className="h-12 w-full border-vert-fonce text-base text-vert-fonce hover:bg-vert-pale/60"
        >
          {pending && submitted === "card" ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
          Payer par carte bancaire
        </Button>
      </div>

      <PaymentBadges className="justify-center pt-1" />

      <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
        <Lock className="size-3.5 shrink-0" aria-hidden /> Paiement sécurisé par PawaPay et MoneyFusion. Vitalya ne voit jamais vos codes ni votre carte.
      </p>
    </form>
  )
}
