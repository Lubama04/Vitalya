import { cn } from "@/lib/utils"

// Moyens de paiement acceptés, en pastilles aux couleurs de chaque réseau
// (texte uniquement : aucun logo de marque n'est embarqué dans le site).
const METHODS = [
  { name: "Orange Money", className: "bg-[#FF7900] text-black" },
  { name: "Airtel Money", className: "bg-[#E40000] text-white" },
  { name: "MTN MoMo", className: "bg-[#FFCC00] text-black" },
  { name: "Wave", className: "bg-[#1DC8FF] text-[#0B1F3A]" },
  { name: "VISA", className: "bg-[#1A1F71] text-white italic tracking-wider" },
  { name: "Mastercard", className: "bg-[#231F20] text-white" },
] as const

export function PaymentBadges({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Moyens de paiement acceptés">
      {METHODS.map((method) => (
        <li key={method.name} className={cn("rounded-md px-2 py-1 text-[0.7rem] leading-none font-bold", method.className)}>
          {method.name}
        </li>
      ))}
    </ul>
  )
}
