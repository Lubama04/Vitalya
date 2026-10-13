import type { Metadata } from "next"
import { ContactLink, LegalPage } from "@/components/legal-page"

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Éditeur, hébergement et propriété intellectuelle du magazine Vitalya.",
  alternates: { canonical: "/mentions-legales" },
}

export default function MentionsLegalesPage() {
  return (
    <LegalPage
      title="Mentions légales"
      updatedAt="octobre 2026"
      sections={[
        {
          title: "Éditeur du site",
          content: (
            <>
              <p>
                Vitalya est un magazine digital édité par <strong>ETS FLAUGUST BUSINESS</strong>.
              </p>
              <ul>
                <li>RCCM : enregistré le 09/08/2024 à Sarh, Tchad</li>
                <li>Adresse : Sarh, Tchad</li>
                <li>
                  Email : <ContactLink />
                </li>
                <li>
                  Téléphone : <a href="tel:+23563731787">+235 63 73 17 87</a> / <a href="tel:+23595501764">95 50 17 64</a>
                </li>
                <li>Directeur de publication : LUBAMA Jean Chrysostome ZACEI</li>
              </ul>
            </>
          ),
        },
        {
          title: "Hébergement",
          content: (
            <address className="not-italic">
              Vercel Inc.
              <br />
              440 N Barranca Ave #4133
              <br />
              Covina, CA 91723, États-Unis
            </address>
          ),
        },
        {
          title: "Base de données",
          content: (
            <address className="not-italic">
              Supabase Inc.
              <br />
              970 Toa Payoh North, Singapour
            </address>
          ),
        },
        {
          title: "Propriété intellectuelle",
          content: (
            <>
              <p>
                L&apos;ensemble du contenu de Vitalya (textes, images, graphismes, logo) est protégé par le droit d&apos;auteur.
              </p>
              <p>© 2026 Vitalya. Tous droits réservés.</p>
            </>
          ),
        },
      ]}
    />
  )
}
