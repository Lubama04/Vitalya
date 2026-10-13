import type { Metadata } from "next"
import { ContactLink, LegalPage } from "@/components/legal-page"

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Données collectées par Vitalya, finalités, conservation et droits des abonnés.",
  alternates: { canonical: "/confidentialite" },
}

export default function ConfidentialitePage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      updatedAt="octobre 2026"
      sections={[
        {
          title: "Responsable du traitement",
          content: (
            <p>
              <strong>ETS FLAUGUST BUSINESS</strong> · <ContactLink />
            </p>
          ),
        },
        {
          title: "Données collectées",
          content: (
            <ul>
              <li>Lors de l&apos;inscription : nom, adresse email, pays, mot de passe (chiffré).</li>
              <li>
                Lors du paiement : numéro de téléphone (Mobile Money) ou données carte traitées par nos partenaires de paiement.
              </li>
              <li>Navigation : adresse IP, pages visitées, temps de lecture (anonymisés).</li>
            </ul>
          ),
        },
        {
          title: "Finalité",
          content: (
            <ul>
              <li>Gestion des comptes abonnés.</li>
              <li>Envoi de la newsletter et des emails de confirmation.</li>
              <li>Amélioration du contenu éditorial.</li>
            </ul>
          ),
        },
        {
          title: "Conservation",
          content: <p>Les données sont conservées pendant la durée de l&apos;abonnement et 12 mois après résiliation.</p>,
        },
        {
          title: "Partage des données",
          content: (
            <>
              <p>Vitalya ne vend aucune donnée personnelle.</p>
              <p>
                Les données de paiement sont traitées exclusivement par nos partenaires (prestataires de paiement sécurisés).
              </p>
            </>
          ),
        },
        {
          title: "Droits des utilisateurs",
          content: (
            <p>
              Tout abonné peut demander l&apos;accès, la rectification ou la suppression de ses données en écrivant à : <ContactLink />
            </p>
          ),
        },
        {
          title: "Cookies",
          content: (
            <p>
              Vitalya utilise uniquement des cookies techniques nécessaires au fonctionnement du site. Aucun cookie publicitaire.
            </p>
          ),
        },
        {
          title: "Modifications",
          content: (
            <>
              <p>Vitalya se réserve le droit de mettre à jour cette politique à tout moment.</p>
              <p>La date de dernière mise à jour est indiquée en bas de page.</p>
            </>
          ),
        },
      ]}
    />
  )
}
