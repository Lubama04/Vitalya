-- Modèle « Template N°01 — Lancement » (HTML complet, variables {{prénom}} et {{lien_desabonnement}})
insert into public.newsletter_templates (name, format, subject, content)
values (
  'Template N°01 — Lancement',
  'html',
  'Vitalya N°01 est en ligne : la beauté africaine au naturel',
  $html$<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vitalya N°01 est en ligne</title>
</head>
<body style="margin:0;background:#FAF7F2;font-family:Helvetica,Arial,sans-serif;color:#1E2532">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">Le premier numéro de Vitalya est disponible : baobab, moringa, routine peau noire et plus encore.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden">
        <tr><td><a href="https://vitalya.africa"><img src="https://vitalya.africa/brand/banniere-email.png" width="600" alt="Vitalya, Santé · Beauté · Bien-être" style="display:block;width:100%;height:auto;border:0"></a></td></tr>
        <tr><td style="height:4px;background:#E8813A"></td></tr>
        <tr><td style="padding:32px 36px 8px">
          <p style="margin:0 0 8px;color:#AD5418;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">Numéro 01 · Avril 2026</p>
          <h1 style="font-family:Georgia,serif;color:#0D6B4A;font-size:30px;line-height:1.2;margin:0 0 20px">La beauté africaine au naturel</h1>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.7">Bonjour {{prénom}},</p>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.7">Le premier numéro de <strong>Vitalya</strong> est en ligne ! Un magazine pensé pour la santé, la beauté et le bien-être des femmes et des hommes d'Afrique et de la diaspora, avec des conseils fiables et des savoirs de chez nous.</p>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.7">Au sommaire de ce numéro :</p>
        </td></tr>
        <tr><td style="padding:0 36px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding-bottom:20px">
              <a href="https://vitalya.africa/articles/huile-de-baobab-le-secret-que-lafrique-gardait"><img src="https://images.unsplash.com/photo-1648203276014-20f97ba1f817?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080" width="528" alt="" style="display:block;width:100%;height:auto;border:0;border-radius:12px"></a>
              <h2 style="font-family:Georgia,serif;color:#0D6B4A;font-size:20px;margin:14px 0 6px">Huile de baobab : le secret que l'Afrique gardait</h2>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#374151">Hydratation, éclat, souplesse : ce que l'huile de l'arbre de vie peut réellement faire pour votre peau et vos cheveux.</p>
            </td></tr>
            <tr><td style="padding-bottom:20px">
              <a href="https://vitalya.africa/articles/moringa-verites-et-mensonges"><img src="https://images.unsplash.com/photo-1771643033515-0028fd03b708?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080" width="528" alt="" style="display:block;width:100%;height:auto;border:0;border-radius:12px"></a>
              <h2 style="font-family:Georgia,serif;color:#0D6B4A;font-size:20px;margin:14px 0 6px">Moringa : vérités et mensonges</h2>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#374151">Ce que la plante miracle soigne vraiment, ce qu'elle ne peut pas faire, et comment la consommer sans risque.</p>
            </td></tr>
            <tr><td style="padding-bottom:8px">
              <p style="margin:0;font-size:15px;line-height:1.7;color:#374151">Et aussi : la routine beauté peau noire en 5 étapes, les 7 erreurs qui cassent vos boucles, le fonio et le sorgho, le burn-out en Afrique…</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:24px 36px 8px">
          <a href="https://vitalya.africa/articles" style="display:inline-block;background:#0D6B4A;color:#FFFFFF;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:10px">Lire le N°01</a>
        </td></tr>
        <tr><td align="center" style="padding:8px 36px 32px">
          <a href="https://vitalya.africa/magazine" style="display:inline-block;background:#E8813A;color:#1E2532;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px">Télécharger le magazine (PDF)</a>
        </td></tr>
        <tr><td style="padding:0 36px 28px">
          <p style="margin:0;font-size:15px;line-height:1.7">Bonne lecture,<br><em>La rédaction de Vitalya</em></p>
        </td></tr>
        <tr><td style="background:#0D6B4A;color:#D6F0E6;padding:24px 36px;font-size:13px;line-height:1.6">
          <p style="margin:0;font-family:Georgia,serif;font-style:italic;color:#F4B942;font-size:15px">Vivre mieux, naturellement.</p>
          <p style="margin:8px 0 0">Vous recevez cet email car vous êtes inscrit·e à la lettre Vitalya. <a href="{{lien_desabonnement}}" style="color:#FFFFFF">Se désinscrire</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>$html$
)
on conflict (name) do nothing;
