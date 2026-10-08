import type { LucideIcon } from "lucide-react"
import {
  AlignLeft,
  BadgeCheck,
  BookMarked,
  BookOpenCheck,
  CaseUpper,
  Columns2,
  Film,
  FlaskConical,
  GalleryHorizontalEnd,
  Gauge,
  Heading2,
  Heading3,
  Image as ImageIcon,
  LayoutPanelTop,
  Lightbulb,
  ListTree,
  Minus,
  MousePointerClick,
  Newspaper,
  PanelTop,
  Quote,
  Scale,
  SquareSplitHorizontal,
  Stethoscope,
  Superscript,
  TriangleAlert,
  SquarePlay as Youtube,
  ChartColumnBig,
} from "lucide-react"
import { parseYouTubeId } from "@/lib/mdx/urls"

// ═══════════════════════════════════════════════════════════════
// Catalogue des insertions de l'éditeur (menu « + »).
// Chaque entrée insère du MDX au curseur, soit directement (snippet),
// soit après une boîte de dialogue (champs, upload, sélection d'article).
// « ‸ » marque la position du curseur après insertion.
// ═══════════════════════════════════════════════════════════════

export const CARET = "‸"

export type FieldKind =
  | "text"
  | "textarea"
  | "url"
  | "number"
  | "select"
  | "image"
  | "images"
  | "video"
  | "article"

export type DialogField = {
  name: string
  label: string
  kind: FieldKind
  required?: boolean
  placeholder?: string
  help?: string
  options?: { value: string; label: string }[]
  defaultValue?: string | ((content: string) => string)
}

export type DialogSpec = {
  title: string
  description?: string
  submitLabel?: string
  fields: DialogField[]
  /** Valeurs (chaînes) → MDX. Les champs image/vidéo contiennent l'URL importée. */
  build: (values: Record<string, string>) => string
  /** Validation supplémentaire ; renvoie un message d'erreur ou null. */
  validate?: (values: Record<string, string>) => string | null
}

export type InsertAction =
  | { kind: "snippet"; build: (selection: string) => string }
  | { kind: "dialog"; dialog: DialogSpec }

export type CatalogItem = { id: string; label: string; hint: string; icon: LucideIcon; action: InsertAction }
export type CatalogGroup = { id: string; label: string; icon: LucideIcon; items: CatalogItem[] }

// ─── Échappement ──────────────────────────────────────────────

/** Valeur d'attribut JSX entre guillemets (références de caractères MDX). */
export function attr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/[\r\n]+/g, " ").trim()
}

/** Texte libre inséré dans le contenu : neutralise les accolades et chevrons MDX. */
export function text(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/([{}<>])/g, "\\$1").trim()
}

const block = (body: string) => `\n\n${body}\n\n`

/** Plus grand numéro de <Source n="…"> présent dans le contenu. */
function lastSourceNumber(content: string): number {
  const numbers = [...content.matchAll(/<Source[^>]*\bn="(\d+)"/g)].map((match) => Number(match[1]))
  return numbers.length ? Math.max(...numbers) : 0
}

const TAILLES = [
  { value: "normal", label: "Colonne de lecture" },
  { value: "large", label: "Large" },
  { value: "pleine", label: "Pleine largeur" },
]

// ─── Catalogue ────────────────────────────────────────────────

export const CATALOG: CatalogGroup[] = [
  {
    id: "texte",
    label: "Texte",
    icon: CaseUpper,
    items: [
      {
        id: "h2",
        label: "Titre H2",
        hint: "Intertitre principal (apparaît dans le sommaire)",
        icon: Heading2,
        action: { kind: "snippet", build: (s) => block(`## ${s || `${CARET}Intertitre`}`) },
      },
      {
        id: "h3",
        label: "Titre H3",
        hint: "Sous-intertitre (apparaît dans le sommaire)",
        icon: Heading3,
        action: { kind: "snippet", build: (s) => block(`### ${s || `${CARET}Sous-titre`}`) },
      },
      {
        id: "chapeau",
        label: "Chapeau",
        hint: "Résumé introductif de 2 à 4 phrases",
        icon: AlignLeft,
        action: {
          kind: "snippet",
          build: (s) => block(`<Chapeau>\n${s || `${CARET}En deux à quatre phrases, l'essentiel de l'article : le sujet, l'enjeu et ce que le lecteur va apprendre.`}\n</Chapeau>`),
        },
      },
      {
        id: "lettrine",
        label: "Lettrine",
        hint: "Paragraphe ouvert par une grande initiale",
        icon: CaseUpper,
        action: { kind: "snippet", build: (s) => block(`<Lettrine>\n${s || `${CARET}Premier paragraphe de l'article.`}\n</Lettrine>`) },
      },
      {
        id: "citation",
        label: "Citation",
        hint: "Citation mise en valeur, avec auteur",
        icon: Quote,
        action: {
          kind: "dialog",
          dialog: {
            title: "Citation",
            fields: [
              { name: "texte", label: "Citation", kind: "textarea", required: true },
              { name: "auteur", label: "Auteur", kind: "text", placeholder: "Aminata Traoré" },
              { name: "fonction", label: "Fonction", kind: "text", placeholder: "Nutritionniste" },
            ],
            build: (v) =>
              block(
                `<Citation${v.auteur ? ` auteur="${attr(v.auteur)}"` : ""}${v.fonction ? ` fonction="${attr(v.fonction)}"` : ""}>\n${text(v.texte ?? "")}\n</Citation>`,
              ),
          },
        },
      },
    ],
  },
  {
    id: "information",
    label: "Information",
    icon: Lightbulb,
    items: [
      {
        id: "a-retenir",
        label: "À retenir",
        hint: "Encadré des points clés",
        icon: BookOpenCheck,
        action: {
          kind: "snippet",
          build: () => block(`<ARetenir>\n\n- ${CARET}Premier point clé\n- Deuxième point clé\n- Troisième point clé\n\n</ARetenir>`),
        },
      },
      {
        id: "conseil",
        label: "Conseil",
        hint: "Encart conseil pratique",
        icon: Lightbulb,
        action: {
          kind: "snippet",
          build: (s) => block(`<Encart titre="Conseil Vitalya">\n${s || `${CARET}Votre conseil pratique.`}\n</Encart>`),
        },
      },
      {
        id: "avertissement",
        label: "Avertissement",
        hint: "Info, conseil, prudence, attention ou urgence",
        icon: TriangleAlert,
        action: {
          kind: "dialog",
          dialog: {
            title: "Avertissement",
            fields: [
              {
                name: "niveau",
                label: "Niveau",
                kind: "select",
                defaultValue: "prudence",
                options: [
                  { value: "info", label: "Information" },
                  { value: "conseil", label: "Conseil" },
                  { value: "prudence", label: "Prudence" },
                  { value: "attention", label: "Attention" },
                  { value: "urgence", label: "Urgence médicale" },
                ],
              },
              { name: "titre", label: "Titre (facultatif)", kind: "text" },
              { name: "texte", label: "Message", kind: "textarea", required: true },
            ],
            build: (v) =>
              block(`<Avertissement niveau="${attr(v.niveau ?? "info")}"${v.titre ? ` titre="${attr(v.titre)}"` : ""}>\n${text(v.texte ?? "")}\n</Avertissement>`),
          },
        },
      },
      {
        id: "mythe",
        label: "Mythe / Réalité",
        hint: "Démêler une idée reçue",
        icon: Scale,
        action: {
          kind: "dialog",
          dialog: {
            title: "Mythe ou réalité",
            fields: [
              { name: "mythe", label: "Idée reçue", kind: "text", required: true, placeholder: "Le beurre de karité bouche les pores" },
              { name: "realite", label: "Réalité", kind: "text", required: true },
              { name: "explication", label: "Explication (facultatif)", kind: "textarea" },
            ],
            build: (v) =>
              block(
                `<MythesRealites mythe="${attr(v.mythe ?? "")}" realite="${attr(v.realite ?? "")}">${v.explication ? `\n${text(v.explication)}\n` : ""}</MythesRealites>`,
              ),
          },
        },
      },
      {
        id: "niveau-preuve",
        label: "Niveau de preuve",
        hint: "Solidité scientifique, note sur 5",
        icon: Gauge,
        action: {
          kind: "dialog",
          dialog: {
            title: "Niveau de preuve",
            fields: [
              {
                name: "note",
                label: "Note",
                kind: "select",
                defaultValue: "3",
                options: [
                  { value: "1", label: "1 : très faible" },
                  { value: "2", label: "2 : faible" },
                  { value: "3", label: "3 : modéré" },
                  { value: "4", label: "4 : élevé" },
                  { value: "5", label: "5 : très élevé" },
                ],
              },
              { name: "explication", label: "Explication (facultatif)", kind: "textarea", placeholder: "Basé sur deux essais cliniques de petite taille…" },
            ],
            build: (v) =>
              block(
                v.explication
                  ? `<NiveauPreuve note={${Number(v.note) || 3}}>\n${text(v.explication)}\n</NiveauPreuve>`
                  : `<NiveauPreuve note={${Number(v.note) || 3}} />`,
              ),
          },
        },
      },
    ],
  },
  {
    id: "science",
    label: "Science",
    icon: FlaskConical,
    items: [
      {
        id: "source",
        label: "Source",
        hint: "Référence bibliographique numérotée",
        icon: BookMarked,
        action: {
          kind: "dialog",
          dialog: {
            title: "Source",
            description: "Placez vos sources en fin d'article ; appelez-les dans le texte avec « Référence [n] ».",
            fields: [
              { name: "n", label: "Numéro", kind: "number", required: true, defaultValue: (content) => String(lastSourceNumber(content) + 1) },
              { name: "reference", label: "Référence", kind: "textarea", required: true, placeholder: "Auteur A. et al. Titre de l'étude. Revue, 2024." },
              { name: "url", label: "Lien (facultatif)", kind: "url", placeholder: "https://doi.org/…" },
            ],
            validate: (v) => (v.url && !/^https:\/\//.test(v.url) ? "Le lien doit commencer par https://" : null),
            build: (v) =>
              `\n<Source n="${Number(v.n) || 1}"${v.url ? ` url="${attr(v.url)}"` : ""}>${text(v.reference ?? "")}</Source>\n`,
          },
        },
      },
      {
        id: "avis-expert",
        label: "Avis d'expert",
        hint: "Parole de spécialiste avec nom et institution",
        icon: Stethoscope,
        action: {
          kind: "dialog",
          dialog: {
            title: "Avis d'expert",
            fields: [
              { name: "nom", label: "Nom", kind: "text", required: true },
              { name: "profession", label: "Profession", kind: "text", placeholder: "Dermatologue" },
              { name: "institution", label: "Institution", kind: "text", placeholder: "CHU de Dakar" },
              { name: "photo", label: "Photo (facultatif)", kind: "image" },
              { name: "avis", label: "Avis", kind: "textarea", required: true },
            ],
            build: (v) =>
              block(
                `<AvisExpert nom="${attr(v.nom ?? "")}"${v.profession ? ` profession="${attr(v.profession)}"` : ""}${v.institution ? ` institution="${attr(v.institution)}"` : ""}${v.photo ? ` photo="${attr(v.photo)}"` : ""}>\n${text(v.avis ?? "")}\n</AvisExpert>`,
              ),
          },
        },
      },
      {
        id: "ref",
        label: "Référence [n]",
        hint: "Appel de source dans le texte",
        icon: Superscript,
        action: {
          kind: "dialog",
          dialog: {
            title: "Appel de référence",
            fields: [
              { name: "n", label: "Numéro de la source", kind: "number", required: true, defaultValue: (content) => String(Math.max(1, lastSourceNumber(content))) },
            ],
            build: (v) => `<Ref n="${Number(v.n) || 1}" />`,
          },
        },
      },
    ],
  },
  {
    id: "media",
    label: "Média",
    icon: ImageIcon,
    items: [
      {
        id: "image",
        label: "Image",
        hint: "Importer une image avec légende",
        icon: ImageIcon,
        action: {
          kind: "dialog",
          dialog: {
            title: "Image",
            fields: [
              { name: "src", label: "Image", kind: "image", required: true },
              { name: "alt", label: "Texte alternatif", kind: "text", required: true, help: "Décrit l'image pour les lecteurs malvoyants." },
              { name: "legende", label: "Légende", kind: "text" },
              { name: "credit", label: "Crédit", kind: "text" },
              { name: "taille", label: "Taille", kind: "select", defaultValue: "normal", options: TAILLES },
            ],
            build: (v) =>
              block(
                `<Figure src="${attr(v.src ?? "")}" alt="${attr(v.alt ?? "")}"${v.legende ? ` legende="${attr(v.legende)}"` : ""}${v.credit ? ` credit="${attr(v.credit)}"` : ""}${v.taille && v.taille !== "normal" ? ` taille="${attr(v.taille)}"` : ""} />`,
              ),
          },
        },
      },
      {
        id: "infographie",
        label: "Infographie",
        hint: "Grande image explicative + légende",
        icon: ChartColumnBig,
        action: {
          kind: "dialog",
          dialog: {
            title: "Infographie",
            fields: [
              { name: "src", label: "Infographie", kind: "image", required: true },
              { name: "alt", label: "Description", kind: "textarea", required: true, help: "Résumez les informations clés de l'infographie." },
              { name: "legende", label: "Légende", kind: "text" },
              { name: "credit", label: "Crédit", kind: "text" },
            ],
            build: (v) =>
              block(
                `<Infographie src="${attr(v.src ?? "")}" alt="${attr(v.alt ?? "")}"${v.legende ? ` legende="${attr(v.legende)}"` : ""}${v.credit ? ` credit="${attr(v.credit)}"` : ""} />`,
              ),
          },
        },
      },
      {
        id: "galerie",
        label: "Galerie",
        hint: "Plusieurs images en grille",
        icon: GalleryHorizontalEnd,
        action: {
          kind: "dialog",
          dialog: {
            title: "Galerie",
            fields: [
              { name: "images", label: "Images (2 à 24)", kind: "images", required: true },
              { name: "legende", label: "Légende de la galerie", kind: "text" },
            ],
            validate: (v) => ((JSON.parse(v.images || "[]") as string[]).length < 2 ? "Ajoutez au moins 2 images." : null),
            build: (v) => {
              const urls = JSON.parse(v.images || "[]") as string[]
              const json = JSON.stringify(urls.map((src) => ({ src, alt: "" })))
              return block(`<Galerie images={${json}}${v.legende ? ` legende="${attr(v.legende)}"` : ""} />`)
            },
          },
        },
      },
      {
        id: "avant-apres",
        label: "Avant / Après",
        hint: "Comparateur interactif de deux images",
        icon: SquareSplitHorizontal,
        action: {
          kind: "dialog",
          dialog: {
            title: "Avant / Après",
            fields: [
              { name: "avant", label: "Image « avant »", kind: "image", required: true },
              { name: "apres", label: "Image « après »", kind: "image", required: true },
              { name: "legende", label: "Légende", kind: "text" },
            ],
            build: (v) =>
              block(`<AvantApres avant="${attr(v.avant ?? "")}" apres="${attr(v.apres ?? "")}"${v.legende ? ` legende="${attr(v.legende)}"` : ""} />`),
          },
        },
      },
      {
        id: "video",
        label: "Vidéo",
        hint: "Importer une vidéo MP4 ou WebM (50 Mo max)",
        icon: Film,
        action: {
          kind: "dialog",
          dialog: {
            title: "Vidéo",
            fields: [
              { name: "src", label: "Vidéo (MP4 ou WebM)", kind: "video", required: true },
              { name: "poster", label: "Image d'aperçu (facultatif)", kind: "image" },
              { name: "titre", label: "Titre / légende", kind: "text" },
            ],
            build: (v) =>
              block(`<Video src="${attr(v.src ?? "")}"${v.poster ? ` poster="${attr(v.poster)}"` : ""}${v.titre ? ` titre="${attr(v.titre)}"` : ""} />`),
          },
        },
      },
      {
        id: "youtube",
        label: "YouTube",
        hint: "Intégrer une vidéo YouTube par son URL",
        icon: Youtube,
        action: {
          kind: "dialog",
          dialog: {
            title: "Vidéo YouTube",
            fields: [
              { name: "url", label: "URL ou identifiant YouTube", kind: "text", required: true, placeholder: "https://www.youtube.com/watch?v=…" },
              { name: "titre", label: "Titre", kind: "text" },
            ],
            validate: (v) => (parseYouTubeId(v.url ?? "") ? null : "URL YouTube non reconnue."),
            build: (v) =>
              block(`<YouTube videoId="${parseYouTubeId(v.url ?? "") ?? ""}"${v.titre ? ` titre="${attr(v.titre)}"` : ""} />`),
          },
        },
      },
    ],
  },
  {
    id: "mise-en-page",
    label: "Mise en page",
    icon: LayoutPanelTop,
    items: [
      {
        id: "media-text",
        label: "MediaText",
        hint: "Image et texte côte à côte (4 variantes)",
        icon: Columns2,
        action: {
          kind: "dialog",
          dialog: {
            title: "Bloc image + texte",
            fields: [
              { name: "src", label: "Image", kind: "image", required: true },
              { name: "alt", label: "Texte alternatif", kind: "text", required: true },
              {
                name: "variante",
                label: "Variante",
                kind: "select",
                defaultValue: "image-texte",
                options: [
                  { value: "image-texte", label: "Image à gauche, texte à droite" },
                  { value: "texte-image", label: "Texte à gauche, image à droite" },
                  { value: "image-dessous", label: "Texte puis image dessous" },
                  { value: "image-fond", label: "Image en fond, texte par-dessus" },
                ],
              },
              { name: "texte", label: "Texte", kind: "textarea", required: true },
            ],
            build: (v) =>
              block(
                `<MediaText src="${attr(v.src ?? "")}" alt="${attr(v.alt ?? "")}" variante="${attr(v.variante ?? "image-texte")}">\n\n${text(v.texte ?? "")}\n\n</MediaText>`,
              ),
          },
        },
      },
      {
        id: "hero",
        label: "Hero",
        hint: "Grand visuel pleine largeur avec titre",
        icon: PanelTop,
        action: {
          kind: "dialog",
          dialog: {
            title: "Section Hero",
            fields: [
              { name: "src", label: "Image de fond", kind: "image", required: true },
              { name: "titre", label: "Titre", kind: "text", required: true },
              { name: "sousTitre", label: "Sous-titre", kind: "text" },
            ],
            build: (v) =>
              block(`<HeroSection src="${attr(v.src ?? "")}" titre="${attr(v.titre ?? "")}"${v.sousTitre ? ` sousTitre="${attr(v.sousTitre)}"` : ""} />`),
          },
        },
      },
      {
        id: "separateur",
        label: "Séparateur",
        hint: "Feuille, points ou dégradé",
        icon: Minus,
        action: {
          kind: "dialog",
          dialog: {
            title: "Séparateur",
            fields: [
              {
                name: "style",
                label: "Style",
                kind: "select",
                defaultValue: "1",
                options: [
                  { value: "1", label: "Style 1 : filet et feuille" },
                  { value: "2", label: "Style 2 : trois points" },
                  { value: "3", label: "Style 3 : dégradé Vitalya" },
                ],
              },
            ],
            build: (v) => block(`<Separateur style="${attr(v.style ?? "1")}" />`),
          },
        },
      },
      {
        id: "encadre",
        label: "Encadré pleine largeur",
        hint: "Bandeau coloré qui sort de la colonne",
        icon: Newspaper,
        action: {
          kind: "dialog",
          dialog: {
            title: "Encadré pleine largeur",
            fields: [
              { name: "titre", label: "Titre", kind: "text" },
              {
                name: "couleur",
                label: "Couleur",
                kind: "select",
                defaultValue: "creme",
                options: [
                  { value: "creme", label: "Crème" },
                  { value: "vert", label: "Vert Vitalya" },
                  { value: "nuit", label: "Nuit" },
                  { value: "or", label: "Or" },
                ],
              },
              { name: "texte", label: "Texte", kind: "textarea", required: true },
            ],
            build: (v) =>
              block(`<Encadre${v.titre ? ` titre="${attr(v.titre)}"` : ""} couleur="${attr(v.couleur ?? "creme")}">\n\n${text(v.texte ?? "")}\n\n</Encadre>`),
          },
        },
      },
    ],
  },
  {
    id: "navigation",
    label: "Navigation",
    icon: ListTree,
    items: [
      {
        id: "sommaire",
        label: "Sommaire",
        hint: "Généré automatiquement depuis les H2 / H3",
        icon: ListTree,
        action: { kind: "snippet", build: () => block("<Sommaire />") },
      },
      {
        id: "a-lire",
        label: "À lire ensuite",
        hint: "3 articles liés, choisis automatiquement",
        icon: BadgeCheck,
        action: { kind: "snippet", build: () => block("<ALireSuite />") },
      },
      {
        id: "cta",
        label: "Bouton CTA",
        hint: "Bouton d'appel à l'action",
        icon: MousePointerClick,
        action: {
          kind: "dialog",
          dialog: {
            title: "Bouton d'appel à l'action",
            fields: [
              { name: "texte", label: "Texte du bouton", kind: "text", required: true, defaultValue: "Je m'abonne" },
              { name: "href", label: "Lien", kind: "text", required: true, defaultValue: "/abonnement", help: "Chemin interne (/abonnement) ou URL https://" },
              {
                name: "variante",
                label: "Style",
                kind: "select",
                defaultValue: "principal",
                options: [
                  { value: "principal", label: "Orange (principal)" },
                  { value: "vert", label: "Vert" },
                  { value: "secondaire", label: "Contour" },
                ],
              },
            ],
            validate: (v) => (/^(https:\/\/|\/(?!\/))/.test(v.href ?? "") ? null : "Le lien doit commencer par / ou https://"),
            build: (v) =>
              block(`<BoutonCTA href="${attr(v.href ?? "/")}" texte="${attr(v.texte ?? "")}"${v.variante && v.variante !== "principal" ? ` variante="${attr(v.variante)}"` : ""} />`),
          },
        },
      },
    ],
  },
]

// ─── Liens (barre rapide) ─────────────────────────────────────

export const EXTERNAL_LINK_DIALOG: DialogSpec = {
  title: "Lien externe",
  fields: [
    { name: "url", label: "URL", kind: "url", required: true, placeholder: "https://…" },
    { name: "texte", label: "Texte du lien", kind: "text", required: true },
  ],
  validate: (v) => (/^https?:\/\//.test(v.url ?? "") ? null : "L'URL doit commencer par http:// ou https://"),
  build: (v) => `[${(v.texte ?? "").replace(/[[\]]/g, "")}](${(v.url ?? "").replace(/[()\s]/g, encodeURIComponent)})`,
}

export const INTERNAL_LINK_DIALOG: DialogSpec = {
  title: "Lien vers un article Vitalya",
  fields: [
    { name: "slug", label: "Article", kind: "article", required: true },
    { name: "texte", label: "Texte du lien (facultatif : titre de l'article par défaut)", kind: "text" },
  ],
  build: (v) => `[${(v.texte || v.articleTitle || "Lire l'article").replace(/[[\]]/g, "")}](/articles/${v.slug ?? ""})`,
}

export const IMAGE_DIALOG = CATALOG.find((group) => group.id === "media")!.items.find((item) => item.id === "image")!.action
export const YOUTUBE_DIALOG = CATALOG.find((group) => group.id === "media")!.items.find((item) => item.id === "youtube")!.action
