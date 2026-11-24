// Helpers for turning the City / Country inputs into a geocoding result.

const normalize = (s) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // accents
    .replace(/[‘’]/g, "'")
    .replace(/&/g, 'and')
    .trim()
    .toLowerCase()

const regionNames = new Intl.DisplayNames(['en'], {
  type: 'region',
  fallback: 'none',
})

// Old or alternative code -> current code: DD -> DE, VD -> VN, YD -> YE, UK -> GB.
const currentCode = (code) => new Intl.Locale(`und-${code}`).region

// English country name -> ISO 3166 code, e.g. "japan" -> "JP".
// OWM geocoding misreads full names ("Osaka,Japan" returns Orsk, RU), so we send codes.
const codeByName = new Map()
for (let i = 0; i < 26; i++) {
  for (let j = 0; j < 26; j++) {
    const code = String.fromCharCode(65 + i, 65 + j)
    const name = regionNames.of(code)
    if (name) codeByName.set(normalize(name), currentCode(code))
  }
}

// Common names that Intl spells differently ("Türkiye", "Hong Kong SAR China", ...).
for (const [name, code] of [
  ['usa', 'US'],
  ['uae', 'AE'],
  ['turkey', 'TR'],
  ['czech republic', 'CZ'],
  ['hong kong', 'HK'],
  ['macau', 'MO'],
  ['burma', 'MM'],
  ['myanmar', 'MM'],
])
  codeByName.set(name, code)

// '' when blank, the ISO code when recognised, null when not.
export function countryCode(input) {
  const s = input.trim()
  if (!s) return ''
  if (/^[a-z]{2}$/i.test(s) && regionNames.of(s.toUpperCase()))
    return currentCode(s.toUpperCase())
  return codeByName.get(normalize(s)) ?? null
}

// OWM geocoding is fuzzy ("Osaka,Japan" returns Orsk, RU), so keep only results whose
// name, state or a local name actually contains what the user typed.
export function pickPlace(results, city, code) {
  const c = normalize(city)
  if (!c) return undefined // every name contains '', so blank would match anything
  return results.find(
    (p) =>
      (!code || p.country === code) &&
      [p.name, p.state, ...Object.values(p.local_names ?? {})]
        .filter(Boolean)
        .some((n) => normalize(n).includes(c)),
  )
}
