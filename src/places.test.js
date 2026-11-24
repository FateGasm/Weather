// Run with: npm test
import { describe, expect, it } from 'vitest'
import { countryCode, pickPlace } from './places.js'

describe('countryCode', () => {
  it.each(['', '   '])('returns an empty string for blank input "%s"', (input) => {
    expect(countryCode(input)).toBe('')
  })

  it.each([
    ['JP', 'JP'],
    ['jp', 'JP'],
    ['Japan', 'JP'],
    [' south korea ', 'KR'],
    ['United Kingdom', 'GB'],
  ])('converts "%s" to %s', (input, code) => {
    expect(countryCode(input)).toBe(code)
  })

  it.each(['Elpis', 'XX'])('returns null for unknown country "%s"', (input) => {
    expect(countryCode(input)).toBeNull()
  })

  // Old codes, alternative codes and common names.
  it.each([
    ['Germany', 'DE'],
    ['Vietnam', 'VN'],
    ['Yemen', 'YE'],
    ['UK', 'GB'],
    ['USA', 'US'],
    ['Turkey', 'TR'],
    ['Czech Republic', 'CZ'],
    ['Hong Kong', 'HK'],
    ['Myanmar', 'MM'],
    // Straight or curly apostrophe, "and" or "&".
    ["Cote d'Ivoire", 'CI'],
    ['Côte d’Ivoire', 'CI'],
    ['Trinidad and Tobago', 'TT'],
    ['Trinidad & Tobago', 'TT'],
  ])('converts "%s" to %s', (input, code) => {
    expect(countryCode(input)).toBe(code)
  })
})

describe('pickPlace', () => {
  const johor = { name: 'Johor Bahru', country: 'MY', state: 'Johor' }
  const singapore = {
    name: 'Singapore',
    country: 'SG',
    local_names: { ms: 'Singapura' },
  }
  const saoPaulo = { name: 'São Paulo', country: 'BR' }
  const narni = { name: 'Narni', country: 'IT', local_names: { la: 'Narnia' } }
  const narnia = { name: 'Narnia', country: 'US' }

  it('matches the main name, ignoring case', () => {
    expect(pickPlace([singapore], 'sINGapore', '')).toBe(singapore)
  })

  it('matches the state name', () => {
    expect(pickPlace([johor], 'johor', 'MY')).toBe(johor)
  })

  it('matches a local name', () => {
    expect(pickPlace([singapore], 'Singapura', '')).toBe(singapore)
  })

  it('ignores accents', () => {
    expect(pickPlace([saoPaulo], 'sao paulo', '')).toBe(saoPaulo)
  })

  it('skips results from another country', () => {
    expect(pickPlace([narni, narnia], 'Narnia', 'US')).toBe(narnia)
  })

  it('returns undefined when the country does not match', () => {
    expect(pickPlace([johor], 'Johor', 'SG')).toBeUndefined()
  })

  it('returns undefined when no name matches', () => {
    expect(pickPlace([johor], 'xxx', '')).toBeUndefined()
  })

  it('returns undefined for an empty result list', () => {
    expect(pickPlace([], 'Tokyo', '')).toBeUndefined()
  })

  it('rejects a city of only spaces', () => {
    expect(pickPlace([johor], '   ', '')).toBeUndefined()
  })
})
