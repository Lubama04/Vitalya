// Référentiel typographique Vitalya (partagé éditeur + rendu).
// Les valeurs saisies dans le MDX sont des clés : jamais de CSS libre.

export const FONTS = {
  playfair: { label: "Playfair Display", variable: "--font-playfair" },
  lora: { label: "Lora", variable: "--font-lora" },
  cormorant: { label: "Cormorant Garamond", variable: "--font-cormorant" },
  merriweather: { label: "Merriweather", variable: "--font-merriweather" },
  "source-serif": { label: "Source Serif Pro", variable: "--font-source-serif" },
  baskerville: { label: "Libre Baskerville", variable: "--font-baskerville" },
} as const

export type FontKey = keyof typeof FONTS

export const COLORS = {
  vert: { label: "Vert Vitalya", hex: "#0D6B4A" },
  "vert-profond": { label: "Vert profond", hex: "#1A9E6B" },
  orange: { label: "Orange Vitalya", hex: "#E8813A" },
  nuit: { label: "Nuit", hex: "#1E2532" },
  creme: { label: "Crème", hex: "#F9F6F1" },
  blanc: { label: "Blanc", hex: "#FFFFFF" },
  gris: { label: "Gris doux", hex: "#6B7280" },
} as const

export type ColorKey = keyof typeof COLORS

/** Police autorisée → famille CSS (avec repli serif). */
export function fontFamily(key: string | undefined): string | undefined {
  if (!key || !(key in FONTS)) return undefined
  return `var(${FONTS[key as FontKey].variable}), Georgia, serif`
}

/** Couleur autorisée → valeur hexadécimale. */
export function colorHex(key: string | undefined): string | undefined {
  if (!key || !(key in COLORS)) return undefined
  return COLORS[key as ColorKey].hex
}

export const FONT_OPTIONS = Object.entries(FONTS).map(([value, font]) => ({ value, label: font.label }))
export const COLOR_OPTIONS = [
  { value: "", label: "Couleur par défaut" },
  ...Object.entries(COLORS).map(([value, color]) => ({ value, label: `${color.label} (${color.hex})` })),
]
