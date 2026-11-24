# Weather

Single-page weather lookup using the OpenWeather API.

## Setup

Make a copy of `.env.example`, then put your OpenWeather API key in `.env`:
```sh
cp .env.example .env
```

Run `npm install` and `npm run dev` to start the app. Runs on port 5173 by default. 
Run `npm test` for tests.


## APIs used

- [Geocoding API](https://openweathermap.org/api/geocoding-api) (`/geo/1.0/direct`): City + Country to latitude/longitude. 
- [Current weather data](https://openweathermap.org/current) (`/data/2.5/weather`): weather for that place, in metric units.

## Notes and Behaviour Assumptions

- An API proxy `/owm` is used to avoid exposing the API key in the browser network tab. **Note:** only runs on dev/preview server, a deployed setup will need its own proxy.
- OpenWeather API requires latitude and longitude as parameters, so the Geocoding API is used to get them (as suggested in OpenWeather API docs).
- Included a button to clear the input fields as per the wireframe mockup.
- Included **Country** input field to distinguish cities with same name, for example "San Jose, US" and "San Jose, Costa Rica". If country field is empty, search result will default to the first matching item in Geocoding API response. 
- **Country** accepts an ISO code (`JP`) or an English name (`Japan`), and is optional. The Geocoding API takes a country code in its parameter, so country name is first converted to country code by a local function (`countryCode` in `src/places.js`). Sending the full name gives wrong results at times (`Osaka, Japan` returned `Orsk, RU` during manual testing on development).
- **Not found** shows when the country isn't recognised, or when no geocoding result's name, state or local name contains the city typed. The Geocoding API is fuzzy and returns some place for almost any text, so this filter is needed. Whole names work best; partial names like "Kuala Lum" don't match.
- For the image shown in the weather result, "Sun" image is shown during the day and "Cloud" during the night, regardless of weather conditions. Determined using `d`/`n` suffix of icon code in API response.
- The timestamp in the weather result is when the weather data is calculated in the local time of the target city.
- The timestamp in the search history is the user's local time when the query is made.
- Search history is saved in the browser (`localStorage`). 
- **H/L** shows `main.temp_max` / `main.temp_min` from the current weather response. The API docs describe these as the maximum/minimum temperature at the moment.
