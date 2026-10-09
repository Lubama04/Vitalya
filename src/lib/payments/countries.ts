// Pays et routage des paiements Mobile Money.
// Les noms des pays sont produits en français par Intl.DisplayNames (aucune liste figée de noms).

/** Codes ISO 3166-1 alpha-2 (tous les pays et territoires). */
export const ISO_COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS",
  "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN",
  "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE",
  "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF",
  "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM",
  "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM",
  "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC",
  "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK",
  "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA",
  "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG",
  "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
  "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO",
  "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
  "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW",
] as const

export type CountryCode = (typeof ISO_COUNTRY_CODES)[number]

export function isCountryCode(value: unknown): value is CountryCode {
  return typeof value === "string" && (ISO_COUNTRY_CODES as readonly string[]).includes(value)
}

/** Routage du Mobile Money : prestataire principal, secondaire seul, ou les deux (avec bascule). */
export type MobileRoute = "pawapay" | "moneyfusion" | "both"

export type MobileMoneyCountry = {
  alpha3: string
  dialCode: string
  currency: string
  route: MobileRoute
}

/**
 * Pays où le Mobile Money est proposé (union des deux prestataires).
 * - moneyfusion : Tchad, Centrafrique, Guinée-Bissau, Guinée, Niger, Togo, Congo-Brazzaville
 * - both : pays couverts par les deux (PawaPay d'abord, MoneyFusion en secours)
 * - pawapay : autres pays (devise locale)
 */
export const MOBILE_MONEY_COUNTRIES: Partial<Record<CountryCode, MobileMoneyCountry>> = {
  BJ: { alpha3: "BEN", dialCode: "229", currency: "XOF", route: "both" },
  BF: { alpha3: "BFA", dialCode: "226", currency: "XOF", route: "both" },
  CM: { alpha3: "CMR", dialCode: "237", currency: "XAF", route: "both" },
  CF: { alpha3: "CAF", dialCode: "236", currency: "XAF", route: "moneyfusion" },
  CI: { alpha3: "CIV", dialCode: "225", currency: "XOF", route: "both" },
  CD: { alpha3: "COD", dialCode: "243", currency: "CDF", route: "pawapay" },
  CG: { alpha3: "COG", dialCode: "242", currency: "XAF", route: "moneyfusion" },
  GA: { alpha3: "GAB", dialCode: "241", currency: "XAF", route: "both" },
  GH: { alpha3: "GHA", dialCode: "233", currency: "GHS", route: "pawapay" },
  GW: { alpha3: "GNB", dialCode: "245", currency: "XOF", route: "moneyfusion" },
  GN: { alpha3: "GIN", dialCode: "224", currency: "GNF", route: "moneyfusion" },
  KE: { alpha3: "KEN", dialCode: "254", currency: "KES", route: "pawapay" },
  MW: { alpha3: "MWI", dialCode: "265", currency: "MWK", route: "pawapay" },
  MZ: { alpha3: "MOZ", dialCode: "258", currency: "MZN", route: "pawapay" },
  NE: { alpha3: "NER", dialCode: "227", currency: "XOF", route: "moneyfusion" },
  NG: { alpha3: "NGA", dialCode: "234", currency: "NGN", route: "pawapay" },
  RW: { alpha3: "RWA", dialCode: "250", currency: "RWF", route: "pawapay" },
  SN: { alpha3: "SEN", dialCode: "221", currency: "XOF", route: "both" },
  SL: { alpha3: "SLE", dialCode: "232", currency: "SLE", route: "pawapay" },
  TD: { alpha3: "TCD", dialCode: "235", currency: "XAF", route: "moneyfusion" },
  TZ: { alpha3: "TZA", dialCode: "255", currency: "TZS", route: "pawapay" },
  TG: { alpha3: "TGO", dialCode: "228", currency: "XOF", route: "moneyfusion" },
  UG: { alpha3: "UGA", dialCode: "256", currency: "UGX", route: "pawapay" },
  ZM: { alpha3: "ZMB", dialCode: "260", currency: "ZMW", route: "pawapay" },
}

export function mobileMoneyCountry(code: string | null | undefined): MobileMoneyCountry | null {
  return code && isCountryCode(code) ? (MOBILE_MONEY_COUNTRIES[code] ?? null) : null
}

/** Tous les pays, nommés en français et triés par ordre alphabétique. */
export function countryOptions(): { code: CountryCode; name: string }[] {
  const names = new Intl.DisplayNames(["fr"], { type: "region" })
  return ISO_COUNTRY_CODES.map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) =>
    a.name.localeCompare(b.name, "fr", { sensitivity: "base" }),
  )
}
