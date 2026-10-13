// Gabarits HTML des emails Vitalya (newsletter, bienvenue, nouvel article, paiement).
// Module sans dépendance serveur : également utilisé pour l'aperçu en direct de l'éditeur newsletter.
// Tout contenu variable est TOUJOURS échappé ; le corps de newsletter reçoit un markdown minimal.

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

const CTA_COLORS = { vert: { bg: "#0D6B4A", fg: "#FFFFFF" }, orange: { bg: "#E8813A", fg: "#1E2532" } } as const

/** Bouton d'appel à l'action compatible messageries (lien stylé en ligne). */
export function ctaButton(label: string, href: string, color: keyof typeof CTA_COLORS = "vert"): string {
  const { bg, fg } = CTA_COLORS[color]
  return `<p style="margin:24px 0;text-align:center"><a href="${href}" style="display:inline-block;background:${bg};color:${fg};text-decoration:none;font-weight:600;padding:13px 26px;border-radius:10px">${label}</a></p>`
}

function inline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Liens limités à https (l'URL est déjà échappée)
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" style="color:#13805A;text-decoration:underline">$1</a>')
    .replace(/\n/g, "<br>")
}

/**
 * Markdown de la newsletter :
 * paragraphes, **gras**, *italique*, [lien](https://…), ## titres,
 * ![texte](https://image) (image), [[Texte|https://lien|vert|orange]] (bouton), --- (séparateur).
 */
export function renderNewsletterBody(markdown: string): string {
  return markdown
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const raw = block.trim()
      if (/^-{3,}$/.test(raw)) {
        return '<hr style="border:0;border-top:1px solid #D6F0E6;margin:28px 0">'
      }
      const escaped = escapeHtml(raw)
      const image = escaped.match(/^!\[([^\]]*)\]\((https:\/\/[^)\s]+)\)$/)
      if (image) {
        return `<p style="margin:0 0 16px"><img src="${image[2]}" alt="${image[1]}" width="528" style="display:block;width:100%;max-width:528px;height:auto;border:0;border-radius:12px"></p>`
      }
      const button = escaped.match(/^\[\[([^|\]]+)\|(https:\/\/[^|\]\s]+)(?:\|(vert|orange))?\]\]$/)
      if (button) return ctaButton(button[1], button[2], button[3] === "orange" ? "orange" : "vert")
      if (escaped.startsWith("## ")) {
        return `<h2 style="font-family:Georgia,serif;color:#0D6B4A;font-size:22px;margin:28px 0 12px">${inline(escaped.slice(3))}</h2>`
      }
      return `<p style="margin:0 0 16px;line-height:1.7">${inline(escaped)}</p>`
    })
    .join("\n")
}

/**
 * Variables personnalisées : {{prénom}} (prénom de l'abonné, retiré proprement s'il est inconnu :
 * « Bonjour {{prénom}}, » devient « Bonjour, ») et {{lien_desabonnement}}.
 */
export function applyPlaceholders(html: string, values: { firstName: string | null; unsubscribeUrl: string }): string {
  const name = values.firstName?.trim() ? escapeHtml(values.firstName.trim()) : ""
  return html
    .replace(/\s*\{\{\s*pr[ée]nom\s*\}\}/gi, (match) => (name ? `${match.match(/^\s*/)?.[0] ?? ""}${name}` : ""))
    .replace(/\{\{\s*lien_d[ée]sabonnement\s*\}\}/gi, values.unsubscribeUrl)
}

/** Paragraphe de texte brut échappé. */
export function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;line-height:1.7">${escapeHtml(text)}</p>`
}

/**
 * Mise en page commune : bannière, liseré orange, titre, contenu (HTML déjà sûr),
 * bouton d'action facultatif, pied de page vert avec la mention de réception.
 */
export function emailLayout(options: {
  siteUrl: string
  title: string
  /** Aperçu affiché par les messageries sous l'objet */
  preheader?: string
  contentHtml: string
  cta?: { label: string; href: string }
  /** Mention de réception (HTML sûr), ex. lien de désinscription */
  footerHtml: string
  /** Image principale (ex. couverture d'article), URL absolue */
  imageUrl?: string
}): string {
  const { siteUrl, title, preheader, contentHtml, cta, footerHtml, imageUrl } = options
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#FAF7F2;font-family:Inter,Helvetica,Arial,sans-serif;color:#1E2532">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden">
        <tr><td><a href="${siteUrl}"><img src="${siteUrl}/brand/banniere-email.png" width="600" alt="Vitalya, Santé · Beauté · Bien-être" style="display:block;width:100%;height:auto;border:0"></a></td></tr>
        <tr><td style="height:4px;background:#E8813A"></td></tr>
        ${imageUrl ? `<tr><td><img src="${escapeHtml(imageUrl)}" width="600" alt="" style="display:block;width:100%;height:auto;border:0"></td></tr>` : ""}
        <tr><td style="padding:32px 36px 8px">
          <h1 style="font-family:Georgia,serif;color:#0D6B4A;font-size:28px;line-height:1.25;margin:0 0 20px">${escapeHtml(title)}</h1>
          <div style="font-size:16px">${contentHtml}</div>
        </td></tr>
        ${
          cta
            ? `<tr><td style="padding:8px 36px 32px">
          <a href="${escapeHtml(cta.href)}" style="display:inline-block;background:#E8813A;color:#1E2532;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">${escapeHtml(cta.label)}</a>
        </td></tr>`
            : ""
        }
        <tr><td style="background:#0D6B4A;color:#D6F0E6;padding:24px 36px;font-size:13px;line-height:1.6">
          <p style="margin:0;font-family:Georgia,serif;font-style:italic;color:#F4B942;font-size:15px">Vivre mieux, naturellement.</p>
          <p style="margin:8px 0 0">${footerHtml}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export type NewsletterFormat = "markdown" | "html"

/**
 * Newsletter prête à l'envoi pour un abonné.
 * markdown : corps mis en page dans le gabarit Vitalya ; html : document HTML complet fourni tel quel.
 * Dans les deux cas, {{prénom}} et {{lien_desabonnement}} sont remplacés.
 */
export function newsletterHtml(options: {
  subject: string
  body: string
  siteUrl: string
  unsubscribeUrl: string
  format?: NewsletterFormat
  firstName?: string | null
}): string {
  const { subject, body, siteUrl, unsubscribeUrl, format = "markdown", firstName = null } = options
  const html =
    format === "html"
      ? body
      : emailLayout({
          siteUrl,
          title: subject,
          contentHtml: renderNewsletterBody(body),
          cta: { label: "Lire le magazine", href: `${siteUrl}/articles` },
          footerHtml: `Vous recevez cet email car vous êtes inscrit·e à la lettre Vitalya. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#FFFFFF">Se désinscrire</a>`,
        })
  return applyPlaceholders(html, { firstName, unsubscribeUrl })
}

/** Email de bienvenue envoyé à l'inscription. */
export function welcomeEmailHtml(options: { siteUrl: string; name: string | null }): string {
  const { siteUrl, name } = options
  const hello = name ? `Bonjour ${name},` : "Bonjour,"
  return emailLayout({
    siteUrl,
    title: "Bienvenue chez Vitalya",
    preheader: "Votre magazine santé, beauté et bien-être africain.",
    contentHtml: [
      paragraph(hello),
      paragraph(
        "Merci de nous rejoindre. Vitalya vous accompagne chaque semaine avec des articles fiables sur la santé, la beauté naturelle et le bien-être, pensés pour l'Afrique et sa diaspora.",
      ),
      `<p style="margin:0 0 16px;line-height:1.7"><strong>Pour bien commencer :</strong></p>`,
      `<ul style="margin:0 0 16px;padding-left:20px;line-height:1.8">
        <li>Confirmez votre adresse via le lien reçu dans un email séparé.</li>
        <li>Installez l'application sur votre téléphone pour lire même hors connexion.</li>
        <li>Activez, dans votre profil, l'alerte email à chaque nouvel article.</li>
      </ul>`,
      paragraph("Bonne lecture !"),
    ].join("\n"),
    cta: { label: "Découvrir les articles", href: `${siteUrl}/articles` },
    footerHtml: `Vous recevez cet email suite à la création de votre compte Vitalya. <a href="${siteUrl}/profil" style="color:#FFFFFF">Gérer mon compte</a>`,
  })
}

/** Annonce d'un nouvel article aux lecteurs qui l'ont demandé. */
export function newArticleEmailHtml(options: {
  siteUrl: string
  title: string
  subtitle: string | null
  category: string | null
  slug: string
  coverUrl: string | null
  premium: boolean
}): string {
  const { siteUrl, title, subtitle, category, slug, coverUrl, premium } = options
  return emailLayout({
    siteUrl,
    title,
    preheader: subtitle ?? "Nouvel article sur Vitalya",
    imageUrl: coverUrl ?? undefined,
    contentHtml: [
      category
        ? `<p style="margin:0 0 12px;color:#AD5418;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase">${escapeHtml(category)}${premium ? " · Premium" : ""}</p>`
        : "",
      subtitle ? paragraph(subtitle) : "",
    ].join("\n"),
    cta: { label: "Lire l'article", href: `${siteUrl}/articles/${encodeURIComponent(slug)}` },
    footerHtml: `Vous recevez cet email car vous avez activé les alertes de nouveaux articles. <a href="${siteUrl}/profil" style="color:#FFFFFF">Désactiver les alertes</a>`,
  })
}

/** Confirmation d'un paiement d'abonnement. */
export function paymentConfirmationHtml(options: {
  siteUrl: string
  name: string | null
  tier: string
  amount: number
  currency: string
  provider: string
  periodEnd: string
}): string {
  const { siteUrl, name, tier, amount, currency, provider, periodEnd } = options
  const dateFin = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(periodEnd))
  const montant = `${new Intl.NumberFormat("fr-FR").format(amount)} ${currency === "XAF" || currency === "XOF" ? "FCFA" : currency}`
  const row = (label: string, value: string) =>
    `<tr><td style="padding:8px 0;color:#5B6472">${escapeHtml(label)}</td><td style="padding:8px 0;text-align:right;font-weight:600">${escapeHtml(value)}</td></tr>`
  return emailLayout({
    siteUrl,
    title: "Paiement confirmé",
    preheader: `Votre abonnement ${tier} est actif jusqu'au ${dateFin}.`,
    contentHtml: [
      paragraph(name ? `Bonjour ${name},` : "Bonjour,"),
      paragraph(`Merci ! Votre abonnement Vitalya ${tier} est actif. Tous les articles de votre formule sont désormais accessibles.`),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;border-top:1px solid #E5E7EB;border-bottom:1px solid #E5E7EB;font-size:15px">
        ${row("Formule", tier)}
        ${row("Montant", montant)}
        ${row("Moyen de paiement", provider)}
        ${row("Accès jusqu'au", dateFin)}
      </table>`,
      paragraph("Conservez cet email comme justificatif de paiement."),
    ].join("\n"),
    cta: { label: "Lire les articles", href: `${siteUrl}/articles` },
    footerHtml: `Email transactionnel lié à votre abonnement Vitalya. <a href="${siteUrl}/profil" style="color:#FFFFFF">Mon compte</a>`,
  })
}

/** Bienvenue à un nouvel abonné payant (premier abonnement confirmé). */
export function paidWelcomeEmailHtml(options: { siteUrl: string; name: string | null; tier: string }): string {
  const { siteUrl, name, tier } = options
  const expert = tier === "Expert"
  return emailLayout({
    siteUrl,
    title: `Bienvenue dans Vitalya ${tier}`,
    preheader: "Tout le magazine vous est désormais ouvert.",
    contentHtml: [
      paragraph(name ? `Bonjour ${name},` : "Bonjour,"),
      paragraph(
        `Merci de soutenir un média indépendant dédié à la santé, à la beauté et au bien-être africains. Votre formule ${tier} est active.`,
      ),
      `<p style="margin:0 0 16px;line-height:1.7"><strong>Ce qui vous attend :</strong></p>`,
      `<ul style="margin:0 0 16px;padding-left:20px;line-height:1.8">
        <li>Tous les articles Premium et nos dossiers thématiques complets</li>
        ${expert ? "<li>Les articles Expert &amp; Science et les analyses de nos spécialistes</li>" : ""}
        <li>La lecture hors ligne dans l'application installée</li>
        <li>Une alerte email à chaque nouvel article (à activer dans votre profil)</li>
      </ul>`,
      paragraph("Votre accès dure un mois ; vous pourrez le prolonger à tout moment depuis la page Abonnement."),
    ].join("\n"),
    cta: { label: "Commencer la lecture", href: `${siteUrl}/articles` },
    footerHtml: `Email lié à votre abonnement Vitalya. <a href="${siteUrl}/profil" style="color:#FFFFFF">Mon compte</a>`,
  })
}
