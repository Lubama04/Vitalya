import type { Metadata } from "next"
import { ContactLink, LegalPage } from "@/components/legal-page"

export const metadata: Metadata = {
  title: "Conditions générales de vente",
  description: "Conditions des abonnements Premium et Expert au magazine Vitalya.",
  alternates: { canonical: "/cgv" },
}

export default function CgvPage() {
  return (
    <LegalPage
      title="Conditions générales de vente"
      updatedAt="octobre 2026"
      sections={[
        {
          title: "Objet",
          content: (
            <p>
              Les présentes CGV régissent les abonnements au magazine digital Vitalya, édité par <strong>ETS FLAUGUST BUSINESS</strong>.
            </p>
          ),
        },
        {
          title: "Offres et tarifs",
          content: (
            <>
              <ul>
                <li>
                  <strong>Premium</strong> : 6 000 FCFA/mois
                </li>
                <li>
                  <strong>Expert</strong> : 11 000 FCFA/mois
                </li>
              </ul>
              <p>Les prix sont indiqués en francs CFA (FCFA).</p>
              <p>Toute souscription est sans engagement de durée minimale.</p>
            </>
          ),
        },
        {
          title: "Paiement",
          content: (
            <>
              <p>Le paiement s&apos;effectue par Mobile Money ou carte bancaire (Visa/Mastercard).</p>
              <p>L&apos;abonnement est activé immédiatement après confirmation du paiement.</p>
            </>
          ),
        },
        {
          title: "Rétractation et remboursement",
          content: (
            <>
              <p>
                Conformément aux usages du secteur numérique, aucun remboursement ne sera accordé pour une période d&apos;abonnement déjà
                entamée.
              </p>
              <p>L&apos;abonné peut résilier à tout moment.</p>
              <p>La résiliation prend effet à la fin de la période en cours.</p>
            </>
          ),
        },
        {
          title: "Accès au contenu",
          content: (
            <>
              <p>L&apos;accès premium est strictement personnel et ne peut être partagé.</p>
              <p>Vitalya se réserve le droit de suspendre tout compte en cas d&apos;utilisation abusive.</p>
            </>
          ),
        },
        {
          title: "Contact",
          content: (
            <p>
              <ContactLink />
            </p>
          ),
        },
      ]}
    />
  )
}
