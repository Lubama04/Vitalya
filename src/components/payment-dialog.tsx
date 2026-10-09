"use client"

import { useActionState, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { CreditCard, Loader2, ShieldCheck, Smartphone } from "lucide-react"
import { listMobileOperators, startPayment } from "@/actions/payments"
import { initialActionState } from "@/actions/types"
import { PaymentBadges } from "@/components/payment-badges"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatFcfa } from "@/lib/constants"
import { countryOptions, mobileMoneyCountry } from "@/lib/payments/countries"
import { cn } from "@/lib/utils"

type Operator = { code: string; name: string }

/**
 * « Choisir Premium / Expert » : pays (détecté automatiquement), puis
 * « Payer par Mobile Money » (uniquement dans les pays couverts) ou
 * « Payer par Visa / Mastercard » (tous les pays).
 * Le choix du prestataire et la bascule éventuelle se font côté serveur.
 */
export function PaymentDialog({
  tier,
  tierName,
  priceEur,
  priceFcfa,
  label,
  highlighted,
  isAuthenticated,
  defaultCountry,
}: {
  tier: "premium" | "expert"
  tierName: string
  priceEur: number
  priceFcfa: number
  label: string
  highlighted?: boolean
  isAuthenticated: boolean
  defaultCountry: string | null
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
            <span className="font-heading text-3xl font-bold text-nuit">{formatFcfa(priceFcfa)}</span>
            <span>environ {priceEur} € · 1 mois d&apos;accès, sans renouvellement automatique</span>
          </DialogDescription>
        </DialogHeader>
        <PaymentForm tier={tier} defaultCountry={defaultCountry} />
      </DialogContent>
    </Dialog>
  )
}

function PaymentForm({ tier, defaultCountry }: { tier: "premium" | "expert"; defaultCountry: string | null }) {
  const [state, formAction, pending] = useActionState(startPayment, initialActionState)
  const countries = useMemo(() => countryOptions(), [])
  const [country, setCountry] = useState(() => (defaultCountry && countries.some((item) => item.code === defaultCountry) ? defaultCountry : ""))
  const [operators, setOperators] = useState<Operator[]>([])
  const [loadingOperators, startLoading] = useTransition()
  const [submitted, setSubmitted] = useState<"mobile" | "card" | null>(null)

  const mobile = mobileMoneyCountry(country)
  // Le choix de l'opérateur n'est proposé que si le prestataire principal couvre le pays
  const showOperators = mobile !== null && mobile.route !== "moneyfusion" && operators.length > 0

  useEffect(() => {
    let cancelled = false
    setOperators([])
    if (!mobile || mobile.route === "moneyfusion") return
    startLoading(async () => {
      const list = await listMobileOperators(country)
      if (!cancelled) setOperators(list)
    })
    return () => {
      cancelled = true
    }
  }, [country, mobile])

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="tier" value={tier} />

      <div className="space-y-2">
        <Label htmlFor="paiement-pays" className="text-base font-semibold">
          Votre pays
        </Label>
        <select
          id="paiement-pays"
          name="country"
          required
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          autoComplete="country"
          className="h-11 w-full rounded-md border border-input bg-white px-3 text-sm focus-visible:ring-2 focus-visible:ring-vert-emeraude focus-visible:outline-none"
        >
          <option value="" disabled>
            Choisissez votre pays
          </option>
          {countries.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      {mobile && (
        <>
          <div className="space-y-2">
            <Label htmlFor="paiement-telephone">Numéro Mobile Money</Label>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">
                +{mobile.dialCode}
              </span>
              <Input
                id="paiement-telephone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="Votre numéro"
                className="h-11 rounded-l-none"
              />
            </div>
          </div>

          {(showOperators || loadingOperators) && (
            <div className="space-y-2">
              <Label htmlFor="paiement-operateur">Opérateur</Label>
              <select
                id="paiement-operateur"
                name="operator"
                disabled={loadingOperators}
                defaultValue=""
                key={country}
                className="h-11 w-full rounded-md border border-input bg-white px-3 text-sm focus-visible:ring-2 focus-visible:ring-vert-emeraude focus-visible:outline-none disabled:opacity-60"
              >
                <option value="">{loadingOperators ? "Chargement des opérateurs…" : "Je choisirai sur la page de paiement"}</option>
                {operators.map((operator) => (
                  <option key={operator.code} value={operator.code}>
                    {operator.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {state.status === "error" && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}

      <div className="grid gap-2 pt-1">
        {mobile && (
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
        )}
        <Button
          type="submit"
          name="method"
          value="card"
          disabled={pending || !country}
          onClick={() => setSubmitted("card")}
          variant={mobile ? "outline" : "default"}
          className={cn(
            "h-12 w-full text-base",
            mobile ? "border-vert-fonce text-vert-fonce hover:bg-vert-pale/60" : "bg-vert-fonce text-white hover:bg-vert-fonce/90",
          )}
        >
          {pending && submitted === "card" ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
          Payer par Visa / Mastercard
        </Button>
      </div>

      <PaymentBadges className="justify-center pt-1" mobile={Boolean(mobile)} />

      <p className="flex items-center justify-center gap-2 text-center text-sm font-medium text-vert-fonce">
        <ShieldCheck className="size-4 shrink-0" aria-hidden /> Paiement 100% sécurisé et crypté
      </p>
    </form>
  )
}
