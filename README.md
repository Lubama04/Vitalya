# VITALYA — *Vivre mieux, naturellement.*

Magazine digital francophone (PWA) consacré à la **santé**, la **beauté** et le **bien-être africains**.

- **Production** : https://vitalya-mocha.vercel.app
- **Dépôt** : https://github.com/Lubama04/Vitalya
- **Supabase** : projet `vitalya` (`cocheygwpsdbtxegdkzf`, région Paris `eu-west-3`, organisation Flaugust Dev)
- **Vercel** : projet `vitalya` (équipe Flaugust dev, région d'exécution `cdg1`)

---

## Stack

| Couche | Technologie |
| --- | --- |
| Framework | Next.js 15 (App Router, Server Components, Server Actions), TypeScript strict |
| UI | Tailwind CSS v4, shadcn/ui (Radix), lucide-react, Playfair Display + Inter (`next/font`) |
| Données | Supabase : Postgres + RLS, Auth, Storage, Realtime |
| Contenu | MDX (`next-mdx-remote`, JavaScript bloqué + liste blanche de composants) |
| Emails | Resend (newsletter) |
| Paiement | Stripe Checkout + webhook (préparé, inactif tant que non configuré) |
| PWA | `@ducanh2912/next-pwa` (Workbox) : manifeste, cache hors ligne, push préparé |
| Hébergement | Vercel |

## Fonctionnalités

| Route | Description |
| --- | --- |
| `/` | Accueil : hero, couverture du Volume 01, derniers articles, rubriques, CTA abonnement, newsletter |
| `/articles` | Tous les articles (pagination) |
| `/articles/[slug]` | Article : couverture pleine largeur, MDX, **paywall**, j'aime, commentaires en temps réel, articles similaires, JSON-LD |
| `/categories/[slug]` | Articles d'une rubrique |
| `/abonnement` | Offres Gratuit / Premium 5 € / Expert 10 €, FAQ, paiement Stripe |
| `/auth` | Connexion, inscription, mot de passe oublié (`/auth/callback` pour les liens email) |
| `/profil` | Espace abonné : formule, informations, mot de passe, notifications push, articles aimés |
| `/admin` | Back-office : statistiques, articles (création/édition/publication, import de couverture), abonnés (formule et rôle), newsletter |
| `/hors-ligne` | Page de secours du service worker |
| `/newsletter/desinscription` | Désinscription (confirmation) + `POST /api/newsletter/desinscription` (one-click RFC 8058) |
| `POST /api/stripe/webhook` | Synchronisation des abonnements Stripe |

## Démarrage local

```bash
npm install
cp .env.example .env.local   # puis compléter les valeurs
npm run dev                   # http://localhost:3000
```

Scripts : `npm run build` (build de production + service worker), `npm run start`, `npm run lint`, `npx tsc --noEmit`.

> Le service worker n'est généré qu'en production (`npm run build`), il est désactivé en développement.

## Base de données

Migrations versionnées dans [`supabase/migrations`](supabase/migrations) :

1. `20261006120000_schema_initial.sql` — tables, contraintes, index, fonctions, RLS, bucket `covers`, Realtime
2. `20261006120100_contenu_initial.sql` — 5 rubriques + article « Huile de baobab : le secret que l'Afrique gardait »

Tables : `profiles`, `categories`, `articles`, `subscriptions`, `newsletters`, `newsletter_subscribers`, `comments`, `likes`, `push_subscriptions`, `admin_allowlist`.

Types TypeScript : [`src/types/database.ts`](src/types/database.ts) (régénérer avec `npx supabase gen types typescript --project-id cocheygwpsdbtxegdkzf`).

### Niveaux d'accès

| Niveau | Rang | Accès |
| --- | --- | --- |
| `free` | 0 | articles gratuits |
| `premium` | 1 | gratuits + premium (5 €/mois) |
| `expert` | 2 | tout le magazine (10 €/mois) |

Le niveau d'un lecteur est `profiles.subscription_tier`, mis à jour **uniquement** par le webhook Stripe (service role) ou par un administrateur.

### Rôles

`reader` (défaut), `editor` (back-office articles/newsletter), `admin` (tout + gestion des membres + suppression). Les emails présents dans `admin_allowlist` deviennent automatiquement administrateurs à l'inscription. Pour promouvoir un compte existant :

```sql
update public.profiles set role = 'admin' where email = 'personne@exemple.com';
```

## Sécurité

- **RLS activée sur toutes les tables**, aucune politique « allow all ».
- **Paywall côté base** : la colonne `articles.content` n'est pas lisible par les rôles `anon`/`authenticated` (privilège de colonne). Le contenu ne sort que par `get_article_body(slug)`, qui renvoie l'article complet si le niveau du lecteur le permet, sinon les 3 premiers paragraphes. Impossible de contourner le paywall en interrogeant l'API REST.
- **Privilèges de colonnes sur `profiles`** : un lecteur ne peut modifier que `full_name` et `avatar_url` (jamais son rôle ni son abonnement).
- Fonctions `SECURITY DEFINER` avec `search_path` vide ; `EXECUTE` révoqué par défaut puis accordé fonction par fonction.
- **MDX sécurisé** : `blockJS` + `blockDangerousJS`, plugin remark qui supprime tout élément JSX hors liste blanche (`Encart`, `Citation`), imports/exports et expressions ; liens limités à `http(s)`, `mailto` et chemins internes.
- Server Actions : authentification revérifiée (`getUser()`), validation **Zod**, messages d'erreur génériques, protection contre les redirections ouvertes.
- En-têtes : CSP stricte (sources limitées au site + Supabase), HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `poweredByHeader: false`.
- Service worker : pages privées (`/admin`, `/profil`, `/auth`, `/api`) et API Supabase **jamais mises en cache**.
- Webhook Stripe : signature vérifiée, upsert idempotent.
- Newsletter : contenu échappé avant mise en forme, honeypot anti-robots à l'inscription, désinscription par jeton.
- Aucun secret dans le code : tout passe par `.env.local` / variables Vercel.

## Rédiger un article

Le contenu est en Markdown/MDX. Composants disponibles :

```mdx
## Intertitre

<Encart titre="Bon à savoir">
Texte de l'encart, **gras** autorisé.
</Encart>

<Citation auteur="Nom de l'expert">
Une citation marquante.
</Citation>
```

Le paywall affiche les **3 premiers paragraphes** (blocs séparés par une ligne vide) aux lecteurs non abonnés : soignez l'accroche.

## Mise en service des intégrations

### Supabase Auth (à faire dans le dashboard)
1. **Authentication → URL Configuration** : *Site URL* = `https://vitalya-mocha.vercel.app`, *Redirect URLs* = `https://vitalya-mocha.vercel.app/**` et `http://localhost:3000/**`.
2. **Authentication → SMTP** : configurer un SMTP (ex. Resend `smtp.resend.com`). Le SMTP par défaut de Supabase n'envoie qu'aux membres de l'organisation et est très limité.

### Resend
Créer une clé API, vérifier le domaine d'envoi, puis renseigner `RESEND_API_KEY` et `RESEND_FROM_EMAIL` sur Vercel.

### Stripe
1. Créer deux produits récurrents mensuels (Premium 5 €, Expert 10 €) → `STRIPE_PRICE_PREMIUM`, `STRIPE_PRICE_EXPERT`.
2. Webhook vers `https://<domaine>/api/stripe/webhook` avec les événements `checkout.session.completed`, `customer.subscription.created|updated|deleted` → `STRIPE_WEBHOOK_SECRET`.
3. Renseigner `STRIPE_SECRET_KEY` et `SUPABASE_SERVICE_ROLE_KEY`. Le paiement s'active automatiquement quand les 5 variables sont présentes.

### Notifications push
Générer des clés VAPID (`npx web-push generate-vapid-keys`) → `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`. L'abonnement des navigateurs et l'affichage des notifications sont en place (`worker/index.ts`, table `push_subscriptions`) ; reste à brancher l'envoi (ex. bibliothèque `web-push` dans une route serveur ou une Edge Function).

## Structure

```
src/
├── actions/          Server Actions (auth, newsletter, engagement, profil, facturation, admin)
├── app/              Routes App Router (+ manifest.ts, icônes, image Open Graph)
├── components/       UI (shadcn), layout, article, admin, profil
├── lib/              Supabase (client/serveur/middleware), auth, données, env, Stripe, emails
├── middleware.ts     Rafraîchissement de session + protection /profil et /admin
└── types/            Types de la base
worker/               Worker personnalisé fusionné au service worker (push)
supabase/migrations/  Schéma SQL versionné
public/               Logos, icônes PWA, couvertures du Volume 01
```

---

© Vitalya — Santé · Beauté · Bien-être
