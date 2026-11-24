import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'

const tokyo = { name: 'Tokyo', country: 'JP', lat: 35.68, lon: 139.76 }

const weather = (overrides = {}) => ({
  dt: Date.UTC(2022, 8, 1, 20, 30) / 1000, // 1 Sep 2022, 20:30 UTC
  timezone: 9 * 3600, // so 2 Sep 2022, 05:30am in the city
  main: { temp: 26.4, temp_max: 28.6, temp_min: 25.5, humidity: 58 },
  weather: [{ main: 'Clouds', description: 'scattered clouds', icon: '03d' }],
  ...overrides,
})

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status })

// Fake OpenWeather. Either answer can be replaced; no test reaches the network.
function mockApi({
  geo = () => json([tokyo]),
  current = () => json(weather()),
} = {}) {
  const fetchMock = vi.fn(async (url) => {
    if (url.startsWith('/owm/geo/1.0/direct?')) return geo()
    if (url.startsWith('/owm/data/2.5/weather?')) return current()
    throw new Error(`Unexpected request: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const requestedUrls = (fetchMock) => fetchMock.mock.calls.map(([url]) => url)

const entry = (label) => ({ label, lat: 35.68, lon: 139.76, searchedAt: 0 })
const saveHistory = (...labels) =>
  localStorage.setItem('weather-history', JSON.stringify(labels.map(entry)))
const savedHistory = () => JSON.parse(localStorage.getItem('weather-history'))
const savedLabels = () => savedHistory().map((e) => e.label)
const shownLabels = () =>
  screen
    .getAllByRole('listitem')
    .map((li) => within(li).getByRole('button', { name: /^Delete / }))
    .map((button) => button.getAttribute('aria-label').replace('Delete ', ''))

const searchButton = () => screen.getByRole('button', { name: 'Search' })

let user
async function search(city, country = '') {
  await user.type(screen.getByLabelText('City'), city)
  if (country) await user.type(screen.getByLabelText('Country'), country)
  await user.click(searchButton())
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  vi.stubGlobal('matchMedia', () => ({ matches: false })) // jsdom has no matchMedia
  mockApi()
  user = userEvent.setup()
})
afterEach(cleanup)

describe('search', () => {
  it('geocodes the city, then fetches weather for its coordinates', async () => {
    const fetchMock = mockApi()
    render(<App />)
    await search('Tokyo', 'Japan')
    await screen.findByText('26°')
    expect(requestedUrls(fetchMock)).toEqual([
      '/owm/geo/1.0/direct?q=Tokyo%2CJP&limit=5',
      '/owm/data/2.5/weather?lat=35.68&lon=139.76&units=metric',
    ])
  })

  it('searches without a country', async () => {
    const fetchMock = mockApi()
    render(<App />)
    await search('Tokyo')
    await screen.findByText('26°')
    expect(requestedUrls(fetchMock)[0]).toBe(
      '/owm/geo/1.0/direct?q=Tokyo&limit=5',
    )
  })

  it('does not call the API when City is empty', async () => {
    const fetchMock = mockApi()
    render(<App />)
    await user.click(searchButton())
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows Not found for a city of only spaces without calling the API', async () => {
    const fetchMock = mockApi()
    render(<App />)
    await search('   ')
    expect(screen.getByRole('alert').textContent).toBe('Not found')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows Not found for an unknown country without calling the API', async () => {
    const fetchMock = mockApi()
    render(<App />)
    await search('Tokyo', 'Elpis')
    expect(screen.getByRole('alert').textContent).toBe('Not found')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows Not found for an unknown city and saves no history', async () => {
    mockApi({ geo: () => json([]) })
    render(<App />)
    await search('Qwzxvq')
    expect((await screen.findByRole('alert')).textContent).toBe('Not found')
    expect(screen.getByText('No Record')).toBeTruthy()
    expect(searchButton().disabled).toBe(false)
  })

  it.each([
    ['geocoding', { geo: () => json({}, 401) }],
    ['weather', { current: () => json({}, 401) }],
  ])('shows an error when the %s request fails', async (_, api) => {
    mockApi(api)
    render(<App />)
    await search('Tokyo')
    expect((await screen.findByRole('alert')).textContent).toBe(
      'OpenWeather request failed (401)',
    )
    expect(screen.getByText('No Record')).toBeTruthy()
    expect(searchButton().disabled).toBe(false)
  })

  it('shows Loading and disables Search until the response arrives', async () => {
    let respond
    mockApi({ geo: () => new Promise((resolve) => (respond = resolve)) })
    render(<App />)
    await search('Tokyo')
    expect(screen.getByRole('status').textContent).toBe('Loading…')
    expect(searchButton().disabled).toBe(true)

    respond(json([tokyo]))
    await screen.findByText('26°')
    expect(screen.queryByRole('status')).toBeNull()
    expect(searchButton().disabled).toBe(false)
  })
})

describe('weather card', () => {
  it('shows rounded temperatures, humidity, condition and place', async () => {
    render(<App />)
    await search('Tokyo')
    const card = (await screen.findByText('26°')).parentElement
    expect(card.textContent).toContain('H: 29° L: 26°')
    expect(card.textContent).toContain('Tokyo, JP')
    expect(card.textContent).toContain('Humidity: 58%')
    expect(card.textContent).toContain('Clouds')
  })

  it('shows the local time of the city, including a date change', async () => {
    render(<App />)
    await search('Tokyo')
    expect(await screen.findByText('02-09-2022 05:30am')).toBeTruthy()
  })

  it.each([
    ['sun', 'day', '03d'],
    ['cloud', 'night', '03n'],
  ])('shows the %s image by %s', async (image, _, icon) => {
    const condition = { main: 'Clouds', description: 'scattered clouds', icon }
    mockApi({ current: () => json(weather({ weather: [condition] })) })
    render(<App />)
    await search('Tokyo')
    const img = await screen.findByRole('img', { name: 'scattered clouds' })
    expect(img.getAttribute('src')).toContain(`${image}.png`)
  })
})

describe('search history', () => {
  it('shows No Record when empty', () => {
    render(<App />)
    expect(screen.getByText('No Record')).toBeTruthy()
  })

  it('loads saved history', () => {
    saveHistory('Tokyo, JP', 'Seoul, KR')
    render(<App />)
    expect(shownLabels()).toEqual(['Tokyo, JP', 'Seoul, KR'])
  })

  it('adds a new search at the top and saves it', async () => {
    saveHistory('Seoul, KR')
    render(<App />)
    await search('Tokyo')
    await screen.findByText('26°')
    expect(shownLabels()).toEqual(['Tokyo, JP', 'Seoul, KR'])
    expect(savedLabels()).toEqual(['Tokyo, JP', 'Seoul, KR'])
  })

  it('moves an existing city to the top instead of duplicating it', async () => {
    saveHistory('Seoul, KR', 'Tokyo, JP')
    render(<App />)
    await search('Tokyo')
    await screen.findByText('26°')
    expect(shownLabels()).toEqual(['Tokyo, JP', 'Seoul, KR'])
  })

  it('search again fetches fresh weather, updates the time and moves to the top', async () => {
    const fetchMock = mockApi()
    saveHistory('Seoul, KR', 'Tokyo, JP')
    render(<App />)
    await user.click(
      screen.getByRole('button', { name: 'Search Tokyo, JP again' }),
    )
    await screen.findByText('26°')
    expect(requestedUrls(fetchMock)).toEqual([
      '/owm/data/2.5/weather?lat=35.68&lon=139.76&units=metric',
    ])
    expect(shownLabels()).toEqual(['Tokyo, JP', 'Seoul, KR'])
    expect(savedHistory()[0].searchedAt).toBeGreaterThan(0)
  })

  it('deletes only the chosen city and saves the change', async () => {
    saveHistory('Tokyo, JP', 'Seoul, KR')
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Delete Tokyo, JP' }))
    expect(shownLabels()).toEqual(['Seoul, KR'])
    expect(savedLabels()).toEqual(['Seoul, KR'])
  })

  it('starts empty when saved history is not valid JSON', () => {
    localStorage.setItem('weather-history', '{broken')
    render(<App />)
    expect(screen.getByText('No Record')).toBeTruthy()
  })

  it('starts empty when saved history is not a list', () => {
    localStorage.setItem('weather-history', '{}')
    render(<App />)
    expect(screen.getByText('No Record')).toBeTruthy()
  })
})

describe('clear button', () => {
  it('empties both fields and the error but keeps history', async () => {
    saveHistory('Seoul, KR')
    render(<App />)
    await search('Tokyo', 'Elpis')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByLabelText('City').value).toBe('')
    expect(screen.getByLabelText('Country').value).toBe('')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(shownLabels()).toEqual(['Seoul, KR'])
  })
})

describe('theme', () => {
  const theme = () => document.documentElement.dataset.theme

  it.each([
    ['dark', true],
    ['light', false],
  ])('follows a %s system setting by default', (expected, matches) => {
    vi.stubGlobal('matchMedia', () => ({ matches }))
    render(<App />)
    expect(theme()).toBe(expected)
  })

  it('prefers the saved theme over the system setting', () => {
    localStorage.setItem('theme', 'dark')
    render(<App />)
    expect(theme()).toBe('dark')
  })

  it('toggles and saves the theme', async () => {
    render(<App />)
    await user.click(
      screen.getByRole('button', { name: 'Switch to dark theme' }),
    )
    expect(theme()).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(
      screen.getByRole('button', { name: 'Switch to light theme' }),
    ).toBeTruthy()
  })

  it('still renders and toggles when localStorage is blocked', async () => {
    const blocked = () => {
      throw new Error('blocked')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
    render(<App />)
    expect(screen.getByText('No Record')).toBeTruthy()
    await user.click(
      screen.getByRole('button', { name: 'Switch to dark theme' }),
    )
    expect(theme()).toBe('dark')
  })
})
