-- ═══════════════════════════════════════════════════════════════
-- VITALYA — Contenu initial : catégories et article de démarrage
-- ═══════════════════════════════════════════════════════════════

insert into public.categories (name, slug, description, color, position) values
  ('Beauté Naturelle',   'beaute-naturelle',   'Soins, huiles et rituels de beauté issus des trésors végétaux africains.', '#1A9E6B', 1),
  ('Santé & Prévention', 'sante-prevention',   'Comprendre, prévenir et prendre soin de sa santé au quotidien.',           '#0D6B4A', 2),
  ('Bien-être & Mental', 'bien-etre-mental',   'Équilibre émotionnel, gestion du stress et santé mentale.',                '#E8813A', 3),
  ('Nutrition Saine',    'nutrition-saine',    'Superaliments locaux, recettes et conseils pour bien manger.',             '#F4B942', 4),
  ('Expert & Science',   'expert-science',     'Décryptages scientifiques et paroles de spécialistes.',                    '#1E2532', 5)
on conflict (slug) do nothing;

insert into public.articles (
  title, subtitle, slug, content, cover_image, category, access_level,
  published, published_at, reading_time
)
select
  'Huile de baobab : le secret que l''Afrique gardait',
  'Hydratation, éclat, souplesse : ce que l''huile de l''arbre de vie peut réellement faire pour votre peau et vos cheveux.',
  'huile-de-baobab-le-secret-que-lafrique-gardait',
  $mdx$Au Sahel comme en Afrique australe, le baobab domine les paysages depuis des siècles. On l'appelle « l'arbre de vie » : ses feuilles se cuisinent, la pulpe de son fruit — le pain de singe — se boit en jus, et ses graines donnent une huile dorée que les femmes utilisent depuis des générations pour nourrir la peau et les cheveux.

Longtemps restée un savoir de village, cette huile s'invite aujourd'hui dans les rayons des grandes marques cosmétiques. Que contient-elle vraiment ? Et comment l'utiliser sans se tromper ? On fait le point.

## Un arbre millénaire, une huile précieuse

Le baobab africain (*Adansonia digitata*) peut vivre plus de mille ans. Ses fruits, de grosses capsules veloutées, renferment une pulpe blanche et des dizaines de petites graines dures. C'est de ces graines, séchées puis pressées à froid, que l'on extrait l'huile.

Le rendement est faible : il faut plusieurs kilos de graines pour obtenir un litre d'huile. C'est ce qui explique son prix, et l'importance de bien choisir son flacon.

<Encart titre="Bon à savoir">
Une huile de qualité est **vierge**, **pressée à froid** et, idéalement, **biologique**. Sa couleur va du jaune pâle au doré, son odeur est légère, presque neutre. Une odeur rance signifie qu'elle est oxydée : ne l'utilisez pas.
</Encart>

## Ce qu'elle contient

L'huile de baobab se distingue par un profil en acides gras très équilibré :

- **Acide oléique (oméga-9)** : il assouplit la peau et aide les autres actifs à pénétrer.
- **Acide linoléique (oméga-6)** : il participe au maintien de la barrière cutanée et limite la perte en eau.
- **Acide palmitique** : il apporte une texture protectrice, sans effet gras excessif.
- **Vitamine E (tocophérols)** : un antioxydant naturel qui protège l'huile — et votre peau — du vieillissement prématuré lié à l'oxydation.
- **Stérols végétaux** : ils contribuent au confort des peaux sèches et tiraillées.

Résultat : une huile dite « sèche », qui pénètre vite et ne laisse pas de film collant. Un vrai atout sous les climats chauds et humides.

## Ses bienfaits pour la peau

### Hydratation et confort

Appliquée sur une peau légèrement humide, l'huile de baobab scelle l'hydratation. Elle convient particulièrement aux peaux sèches, ternes ou déshydratées par le soleil et l'harmattan.

### Éclat des peaux foncées

Les peaux noires et métissées ont tendance à paraître grises ou cendrées lorsqu'elles manquent de lipides. Quelques gouttes suffisent à redonner un aspect lumineux et uniforme, sans reflets huileux.

### Souplesse et vergetures

Riche en acides gras, elle améliore l'élasticité de la peau. Utilisée en massage régulier pendant la grossesse ou lors des variations de poids, elle aide à **prévenir** l'apparition des vergetures. Elle ne fait pas disparaître celles qui sont installées, mais peut en atténuer l'aspect.

### Peaux sensibles

Sa douceur en fait une alliée des peaux réactives. Elle peut apaiser les sensations d'inconfort, mais elle **ne remplace pas un traitement** en cas d'eczéma ou de dermatite : demandez l'avis d'un dermatologue.

## Ses bienfaits pour les cheveux

Les cheveux crépus et frisés sont naturellement plus secs : le sébum descend difficilement le long de la fibre. L'huile de baobab aide à :

1. **Nourrir les longueurs** et limiter la casse.
2. **Gainer les pointes** pour réduire les fourches.
3. **Apporter de la brillance** sans alourdir.

<Encart titre="Le rituel bain d'huile">
La veille de votre shampoing, appliquez une cuillère à soupe d'huile de baobab tiédie sur les longueurs et les pointes. Massez doucement le cuir chevelu, couvrez d'un bonnet et laissez poser toute la nuit. Lavez ensuite avec un shampoing doux.
</Encart>

## Comment l'utiliser au quotidien

- **Visage** : 2 à 3 gouttes le soir, chauffées entre les paumes, puis pressées sur le visage propre.
- **Corps** : à la sortie de la douche, sur peau humide, pour un fini satiné.
- **Cheveux** : en bain d'huile avant shampoing, ou une goutte sur les pointes pour sceller l'hydratation (méthode LOC).
- **Lèvres et cuticules** : une touche suffit pour les nourrir.

## Les précautions à connaître

L'huile de baobab est très bien tolérée, mais quelques règles s'imposent :

- Faites un **test cutané** dans le pli du coude 48 heures avant la première utilisation.
- Sur une peau à tendance acnéique, utilisez-la avec parcimonie et observez la réaction.
- Conservez le flacon **à l'abri de la lumière et de la chaleur**, bien fermé, et utilisez-le dans les 6 à 12 mois après ouverture.
- Évitez le contact avec les yeux.

## Le mot de la fin

L'huile de baobab n'est pas un produit miracle : c'est un soin simple, efficace et ancré dans nos traditions. Bien choisie et bien utilisée, elle mérite une place dans toutes les routines beauté — de Dakar à Kinshasa, d'Abidjan à Paris.

*Vivre mieux, naturellement.*$mdx$,
  '/covers/huile-de-baobab.webp',
  (select id from public.categories where slug = 'beaute-naturelle'),
  'free',
  true,
  now(),
  6
where not exists (
  select 1 from public.articles where slug = 'huile-de-baobab-le-secret-que-lafrique-gardait'
);
