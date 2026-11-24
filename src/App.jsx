import { useEffect, useState } from 'react'
import cloudImg from './assets/cloud.png'
import moonIcon from './assets/icon-moon.svg'
import searchIcon from './assets/icon-search.svg'
import sunIcon from './assets/icon-sun.svg'
import trashIcon from './assets/icon-trash.svg'
import xIcon from './assets/icon-x.svg'
import sunImg from './assets/sun.png'
import { countryCode, pickPlace } from './places.js'
import { useTheme } from './useTheme.js'

async function owm(path) {
  const res = await fetch(`/owm${path}`)
  if (!res.ok) throw new Error(`OpenWeather request failed (${res.status})`)
  return res.json()
}

const HISTORY_KEY = 'weather-history'

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY))
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

function formatTime(date, timeZone) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  )
  return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}${p.dayPeriod.toLowerCase()}`
}

const cityTime = (w) => formatTime(new Date((w.dt + w.timezone) * 1000), 'UTC')

// depending on city's local time. "Cloud" after sunset time.
const weatherImg = (w) => (w.weather[0].icon.endsWith('d') ? sunImg : cloudImg)

const Icon = ({ src, className = '' }) => (
  <span
    aria-hidden="true"
    className={`inline-block bg-current mask-contain mask-center mask-no-repeat ${className}`}
    style={{ maskImage: `url("${src}")` }}
  />
)

const iconButton =
  'grid size-8 shrink-0 place-items-center rounded-full border border-icon-btn-border bg-icon-btn text-icon hover:brightness-95 disabled:opacity-50 sm:size-9'

const historyShadow = 'shadow-[0_4px_12px_0_rgba(0,0,0,0.1)] dark:shadow-none'

function Field({ id, label, placeholder = ' ', ...props }) {
  return (
    <div className="relative h-13 w-full rounded-2xl bg-surface backdrop-blur-md focus-within:ring-2  sm:w-auto sm:flex-1">
      <input
        id={id}
        placeholder={placeholder}
        className="peer h-full w-full bg-transparent px-5 pt-4 outline-none placeholder:text-transparent focus:placeholder:text-muted/50"
        {...props}
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute top-1.5 left-5 text-[10px] text-muted/70 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-[10px]"
      >
        {label}
      </label>
    </div>
  )
}

function App() {
  const { theme, toggle } = useTheme()
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [weather, setWeather] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState(loadHistory)

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    } catch {
      // Storage blocked (private mode etc.): history just won't persist.
    }
  }, [history])

  // Fetch weather for a resolved place and put it at the top of the history.
  async function show(place) {
    setLoading(true)
    setError('')
    try {
      const data = await owm(
        `/data/2.5/weather?lat=${place.lat}&lon=${place.lon}&units=metric`,
      )
      setWeather({ ...data, label: place.label })
      setHistory((h) => [
        { ...place, searchedAt: Date.now() },
        ...h.filter((e) => e.label !== place.label),
      ])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function onSubmit(e) {
    e.preventDefault()
    setWeather(null)
    const code = countryCode(country)
    if (!city.trim() || code === null) return setError('Not found')
    setLoading(true)
    try {
      const q = [city.trim(), code].filter(Boolean).join(',')
      const results = await owm(
        `/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=5`,
      )
      const p = pickPlace(results, city, code)
      if (!p) {
        setError('Not found')
        setLoading(false)
        return
      }
      await show({ label: `${p.name}, ${p.country}`, lat: p.lat, lon: p.lon })
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  function onClear() {
    setCity('')
    setCountry('')
    setError('')
  }

  return (
    <main className="mx-auto max-w-175 px-4 pt-4 sm:pt-6 pb-12 text-text">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={toggle}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title="Toggle theme"
          className={iconButton}
        >
          {/* theme switcher*/}
          <Icon src={theme === 'dark' ? sunIcon : moonIcon} className="size-4" />
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-3 flex flex-wrap gap-3 sm:flex-nowrap">
        <Field
          id="city"
          label="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          required
        />
        <Field
          id="country"
          label="Country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        />
        <div className="ml-auto flex gap-3">
          <button
            type="submit"
            disabled={loading}
            aria-label="Search"
            title="Search"
            className="grid size-13 place-items-center rounded-2xl bg-button text-white hover:brightness-110 disabled:opacity-60"
          >
            <Icon src={searchIcon} className="size-6" />
          </button>
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear"
            title="Clear"
            className="grid size-13 place-items-center rounded-2xl bg-surface backdrop-blur-md hover:brightness-110"
          >
            <Icon src={xIcon} className="size-5" />
          </button>
        </div>
      </form>

      <section className="relative mt-24 rounded-[40px] border border-surface-border bg-surface px-6 pt-5 pb-6 backdrop-blur-[20px] sm:px-12 sm:pt-12">
        {weather && (
          <img
            src={weatherImg(weather)}
            alt={weather.weather[0].description}
            className="pointer-events-none absolute -top-16 right-2 w-36 sm:-top-24 sm:right-6 sm:w-64"
          />
        )}

        <h1 className="text-sm sm:text-base">Today's Weather</h1>

        {/* error block that shows only on error (nonexisting city/country, api error, etc) */}
        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-red-400 bg-red-500/15 px-4 py-2 text-sm">
            {error}
          </p>
        )}
        {loading && (
          <p role="status" className="mt-3 text-sm text-muted">
            Loading…
          </p>
        )}

        {weather && (
          <div className="grid grid-cols-[1fr_auto] gap-x-4 text-sm text-details sm:flex sm:flex-wrap sm:justify-between sm:gap-y-1 sm:text-base">
            <p className="col-start-1 row-start-1 text-7xl leading-none font-bold text-temp sm:basis-full sm:text-9xl">
              {Math.round(weather.main.temp)}°
            </p>
            <p className="col-start-1 row-start-2 my-2 text-text sm:basis-full">
              H: {Math.round(weather.main.temp_max)}° L: {Math.round(weather.main.temp_min)}°
            </p>
            <p className="col-start-1 row-start-3 font-bold">{weather.label}</p>
            <p className="col-start-2 row-start-3 text-right">{cityTime(weather)}</p>
            <p className="col-start-2 row-start-2 mt-1 text-right sm:mt-0">
              Humidity: {weather.main.humidity}%
            </p>
            <p className="col-start-2 row-start-1 self-end text-right">
              {weather.weather[0].main}
            </p>
          </div>
        )}

        <div className="mt-5  sm:mt-6 rounded-3xl bg-surface p-4 sm:p-6">
          <h2 className="text-sm sm:text-base">Search History</h2>
          {history.length === 0 ? (
            <p className="py-8 text-center text-muted">No Record</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {history.map((h) => (
                <li
                  key={h.label}
                  className="flex items-center gap-2 rounded-2xl bg-row px-2 py-3 text-sm sm:pl-5 sm:pr-4 sm:py-5 sm:text-base"
                >
                  <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-2">
                    <p className="truncate sm:flex-1">{h.label}</p>
                    <p className="text-[10px] text-history-time sm:text-sm">
                      {formatTime(new Date(h.searchedAt))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => show(h)}
                    disabled={loading}
                    aria-label={`Search ${h.label} again`}
                    title="Search again"
                    className={`${iconButton} ${historyShadow}`}
                  >
                    <Icon src={searchIcon} className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setHistory((all) => all.filter((e) => e.label !== h.label))
                    }
                    aria-label={`Delete ${h.label}`}
                    title="Delete"
                    className={`${iconButton} ${historyShadow}`}
                  >
                    <Icon src={trashIcon} className="size-4" />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </main>
  )
}

export default App
