import type { ReactNode } from "react"

export type LegalSection = { title: string; content: ReactNode }

/** Mise en page sobre des pages légales : fond blanc, texte nuit, typographie Inter. */
export function LegalPage({
  title,
  intro,
  sections,
  updatedAt,
}: {
  title: string
  intro?: ReactNode
  sections: LegalSection[]
  updatedAt: string
}) {
  return (
    <div className="bg-white">
      <article className="mx-auto max-w-3xl px-4 py-14 font-sans text-nuit sm:px-6 lg:py-20">
        <header className="border-b pb-8">
          <p className="text-sm font-semibold tracking-wider text-orange-fonce uppercase">Informations légales</p>
          <h1 className="mt-2 font-sans text-4xl font-bold tracking-tight text-nuit">{title}</h1>
          {intro && <div className="mt-4 text-base leading-relaxed text-nuit/80">{intro}</div>}
        </header>

        <div className="divide-y">
          {sections.map((section) => (
            <section key={section.title} className="py-8" aria-labelledby={`section-${slugify(section.title)}`}>
              <h2 id={`section-${slugify(section.title)}`} className="font-sans text-xl font-semibold text-nuit">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-base leading-relaxed text-nuit/85 [&_a]:font-medium [&_a]:text-vert-fonce [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
                {section.content}
              </div>
            </section>
          ))}
        </div>

        <p className="border-t pt-6 text-sm text-nuit/60">Dernière mise à jour : {updatedAt}</p>
      </article>
    </div>
  )
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

/** Adresse de contact de l'éditeur. */
export const CONTACT_EMAIL = "contact@flaugustbusiness.com"

export function ContactLink() {
  return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
}
