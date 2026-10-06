import "server-only"

// Gabarit HTML des emails Vitalya (newsletter).
// Le contenu saisi est TOUJOURS échappé, puis enrichi d'un markdown minimal.

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Markdown minimal : paragraphes, **gras**, *italique*, [lien](https://…), ## titres. */
export function renderNewsletterBody(markdown: string): string {
  return markdown
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      let html = escapeHtml(block.trim())
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        // Liens limités à https (l'URL est déjà échappée)
        .replace(
          /\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g,
          '<a href="$2" style="color:#1A9E6B;text-decoration:underline">$1</a>',
        )
        .replace(/\n/g, "<br>")
      if (html.startsWith("## ")) {
        html = html.slice(3)
        return `<h2 style="font-family:Georgia,serif;color:#0D6B4A;font-size:22px;margin:28px 0 12px">${html}</h2>`
      }
      return `<p style="margin:0 0 16px;line-height:1.7">${html}</p>`
    })
    .join("\n")
}

export function newsletterHtml(options: {
  subject: string
  body: string
  siteUrl: string
  unsubscribeUrl: string
}): string {
  const { subject, body, siteUrl, unsubscribeUrl } = options
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#FAF7F2;font-family:Inter,Helvetica,Arial,sans-serif;color:#1E2532">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden">
        <tr><td><a href="${siteUrl}"><img src="${siteUrl}/brand/banniere-email.png" width="600" alt="Vitalya — Santé · Beauté · Bien-être" style="display:block;width:100%;height:auto;border:0"></a></td></tr>
        <tr><td style="height:4px;background:#E8813A"></td></tr>
        <tr><td style="padding:32px 36px 8px">
          <h1 style="font-family:Georgia,serif;color:#0D6B4A;font-size:28px;line-height:1.25;margin:0 0 20px">${escapeHtml(subject)}</h1>
          <div style="font-size:16px">${renderNewsletterBody(body)}</div>
        </td></tr>
        <tr><td style="padding:8px 36px 32px">
          <a href="${siteUrl}/articles" style="display:inline-block;background:#E8813A;color:#FFFFFF;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">Lire le magazine</a>
        </td></tr>
        <tr><td style="background:#0D6B4A;color:#D6F0E6;padding:24px 36px;font-size:13px;line-height:1.6">
          <p style="margin:0;font-family:Georgia,serif;font-style:italic;color:#F4B942;font-size:15px">Vivre mieux, naturellement.</p>
          <p style="margin:8px 0 0">Vous recevez cet email car vous êtes inscrit·e à la lettre Vitalya.
          <a href="${unsubscribeUrl}" style="color:#FFFFFF">Se désinscrire</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
