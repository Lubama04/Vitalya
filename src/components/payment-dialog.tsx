"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { CreditCard, Loader2, Lock, Smartphone } from "lucide-react"
import { listPawapayOperators, startMoneyFusionPayment, startPawapayCheckout } from "@/actions/payments"
import { initialActionState } from "@/actions/types"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatFcfa } from "@/lib/constants"
import { cn } from "@/lib/utils"

type Method = "pawapay" | "moneyfusion"
type Country = "TCD" | "CMR"
type Operator = { code: string; name: string }

const COUNTRIES: { code: Country; label: string; dial: string; example: string }[] = [
  { code: "TCD", label: "Tchad", dial: "+235", example: "66 12 34 56" },
  { code: "CMR", label: "Cameroun", dial: "+237", example: "6 71 23 45 67" },
]

/**
 * « Choisir Premium / Expert » : choix du moyen de paiement puis formulaire.
 * Mobile Money (PawaPay) pour le Tchad et le Cameroun ; carte bancaire / Wave (MoneyFusion).
 */
export function PaymentDialog({
  tier,
  tierName,
  priceFcfa,
  label,
  highlighted,
  isAuthenticated,
  defaultName,
  available,
}: {
  tier: "premium" | "expert"
  tierName: string
  priceFcfa: number
  label: string
  highlighted?: boolean
  isAuthenticated: boolean
  defaultName: string
  available: Record<Method, boolean>
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
          <DialogDescription>
            {formatFcfa(priceFcfa)} pour 30 jours d&apos;accès, sans renouvellement automatique.
          </DialogDescription>
        </DialogHeader>
        <PaymentForms tier={tier} defaultName={defaultName} available={available} />
      </DialogContent>
    </Dialog>
  )
}

function PaymentForms({ tier, defaultName, available }: { tier: "premium" | "expert"; defaultName: string; available: Record<Method, boolean> }) {
  const [method, setMethod] = useState<Method>(available.pawapay || !available.moneyfusion ? "pawapay" : "moneyfusion")

  const methods: { id: Method; title: string; detail: string; icon: typeof Smartphone }[] = [
    { id: "pawapay", title: "Mobile Money (PawaPay)", detail: "Tchad, Cameroun : MTN, Orange, Airtel…", icon: Smartphone },
    { id: "moneyfusion", title: "Carte bancaire / Wave (MoneyFusion)", detail: "Visa, Mastercard, Wave, Mobile Money UEMOA", icon: CreditCard },
  ]

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Moyen de paiement</legend>
        <div className="grid gap-2">
          {methods.map((item) => (
            <label
              key={item.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-vert-emeraude",
                method === item.id && "border-vert-emeraude bg-vert-pale/50",
                !available[item.id] && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="radio"
                name="methode"
                value={item.id}
                checked={method === item.id}
                disabled={!available[item.id]}
                onChange={() => setMethod(item.id)}
                className="sr-only"
              />
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-vert-fonce shadow-sm">
                <item.icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{item.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {available[item.id] ? item.detail : "Indisponible pour le moment"}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {method === "pawapay" ? <PawapayForm tier={tier} enabled={available.pawapay} /> : <MoneyFusionForm tier={tier} defaultName={defaultName} enabled={available.moneyfusion} />}

      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Lock className="size-3.5" aria-hidden /> Paiement sécurisé par PawaPay et MoneyFusion. Vitalya ne voit jamais vos codes.
      </p>
    </div>
  )
}

function PawapayForm({ tier, enabled }: { tier: "premium" | "expert"; enabled: boolean }) {
  const [state, formAction, pending] = useActionState(startPawapayCheckout, initialActionState)
  const [country, setCountry] = useState<Country>("TCD")
  const [operators, setOperators] = useState<Operator[] | null>(null)
  const [loading, startLoading] = useTransition()

  // Opérateurs ouverts pour le pays choisi (configuration PawaPay en direct)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setOperators(null)
    startLoading(async () => {
      const list = await listPawapayOperators(country)
      if (!cancelled) setOperators(list)
    })
    return () => {
      cancelled = true
    }
  }, [country, enabled])

  const current = COUNTRIES.find((item) => item.code === country) ?? COUNTRIES[0]

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="tier" value={tier} />
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Pays">
        {COUNTRIES.map((item) => (
          <label
            key={item.code}
            className={cn(
              "flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-2.5 text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-vert-emeraude",
              country === item.code && "border-vert-emeraude bg-vert-pale/50",
            )}
          >
            <input type="radio" name="country" value={item.code} checked={country === item.code} onChange={() => setCountry(item.code)} className="sr-only" />
            {item.label}
          </label>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="pawapay-operateur">Opérateur</Label>
        <select
          id="pawapay-operateur"
          name="operator"
          required
          disabled={!enabled || loading || !operators?.length}
          className="h-11 w-full rounded-md border border-input bg-white px-3 text-sm focus-visible:ring-2 focus-visible:ring-vert-emeraude focus-visible:outline-none disabled:opacity-60"
          defaultValue=""
          key={country}
        >
          <option value="" disabled>
            {loading || (enabled && operators === null) ? "Chargement des opérateurs…" : operators?.length ? "Choisissez votre opérateur" : "Aucun opérateur disponible"}
          </option>
          {operators?.map((operator) => (
            <option key={operator.code} value={operator.code}>
              {operator.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pawapay-telephone">Numéro Mobile Money</Label>
        <div className="flex">
          <span className="inline-flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">{current.dial}</span>
          <Input
            id="pawapay-telephone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            required
            placeholder={current.example}
            className="h-11 rounded-l-none"
          />
        </div>
        <p className="text-xs text-muted-foreground">Vous validerez le paiement sur ce téléphone avec votre code secret.</p>
      </div>

      {state.status === "error" && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={!enabled || pending || !operators?.length} className="h-12 w-full bg-orange text-base text-nuit hover:bg-orange/90">
        {pending && <Loader2 className="size-4 animate-spin" />} Payer avec Mobile Money
      </Button>
    </form>
  )
}

function MoneyFusionForm({ tier, defaultName, enabled }: { tier: "premium" | "expert"; defaultName: string; enabled: boolean }) {
  const [state, formAction, pending] = useActionState(startMoneyFusionPayment, initialActionState)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="tier" value={tier} />
      <div className="space-y-2">
        <Label htmlFor="mf-nom">Nom complet</Label>
        <Input id="mf-nom" name="name" required autoComplete="name" defaultValue={defaultName} className="h-11" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mf-telephone">Téléphone (avec indicatif)</Label>
        <Input id="mf-telephone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="+225 07 12 34 56 78" className="h-11" />
        <p className="text-xs text-muted-foreground">Côte d&apos;Ivoire, Sénégal et autres pays UEMOA ; carte Visa / Mastercard partout.</p>
      </div>
      {state.status === "error" && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={!enabled || pending} className="h-12 w-full bg-vert-fonce text-base hover:bg-vert-fonce/90">
        {pending && <Loader2 className="size-4 animate-spin" />} Continuer vers le paiement
      </Button>
    </form>
  )
}
