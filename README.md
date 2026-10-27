# Tabibito — browser edition

A personal flight journal with a world map and rotatable globe, built as a static site for Cloudflare Pages. Add flights manually, search airports, filter your history, view estimated distances, and export map images.

## Run locally

Use Node.js 24 and npm:

```sh
npm ci
npm run dev
```

Create and preview the static build:

```sh
npm run build
npm run preview
```

## Cloudflare Pages

Connect this repository to a Cloudflare Pages project using the React (Vite) preset:

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: repository root
- Node version: `24` (also specified in `.node-version`)

No runtime server, Pages Functions, database bindings, API keys, or authentication service are required. Alternatively upload the built `dist` directory through Pages Direct Upload. See [Cloudflare build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/).

## Your data

Flights are stored in IndexedDB in your browser, scoped to this site's origin. Nothing uploads or synchronizes your flight history. Another browser, device, preview deployment, or domain has separate storage. Clearing site data, private browsing cleanup, or browser storage eviction can remove your history. Export backups regularly, especially before changing domains.

Use **Backup & restore → Download backup** to save a portable JSON file. On another device, choose that file, review the counts, and confirm **Replace history**. Import replaces the entire current history; it does not merge. Export the current history first if you want to keep it. If history changes after the preview (including in another tab), preview the file again before importing.

The JSON format is compatible with Tabibito's local/server version (`app: "tabibito"`, `version: 1`). Airport snapshots, flight IDs, and timestamps survive transfer. Imports validate the file before changing data and accept up to 10,000 flights in files no larger than 10 MB. Browser storage errors are reported rather than silently resetting history.

## Manual flights and maps

Choose departure and arrival airports by city, name, IATA, or ICAO code. Date and flight number are optional. Flight-number API lookup is not available in this edition.

Airport searches run locally against the bundled OurAirports catalog, including closed airports for historical journeys. MapLibre renders routes in the browser using external OpenFreeMap map tiles. Tile requests still require network access and expose ordinary request information to that provider; saved flight records are not sent to it. Journal and backup operations remain available when maps fail. This is not an installable offline PWA.

Distances are great-circle estimates, and route lines are not actual flight tracks. Repeated flights count separately. Map and globe exports include attribution.

## Airport catalog

The catalog and its public-domain provenance are included in `data/`. Normal builds do not fetch airport data. To explicitly refresh it, run `npm run airports:update`, review the changed catalog and provenance, then rebuild. Existing flight snapshots are never rewritten. See [data/README.md](data/README.md).

## Checks

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests run against the production build with isolated browser storage on desktop and mobile viewports. The project has no `/api` endpoints or backend dependencies.

## Languages

Tabibito supports English and Simplified Chinese. On the first visit it selects the
first supported browser language, falling back to English. Generic Chinese and
Simplified Chinese locales select 简体中文; explicitly Traditional Chinese locales
do not. Use the **Language / 语言** selector to override the browser preference.
The choice is saved locally, separately from flight history and backups. Switching
still works for the current session if browser preferences cannot be saved.

The interface, calendar, validation messages, map controls and exported image
captions follow the selected language. Dates are still entered and stored as
`YYYY-MM-DD`. Airport codes and backup/image filenames remain stable.

Available Chinese airport and city names come from a bundled Wikidata snapshot.
Airport and history searches accept Chinese names and aliases as well as original
names and IATA/ICAO codes, in either interface language. Missing or ambiguous
translations retain their original names. Automatic pinyin transliteration is not provided. Saved
airport snapshots and version-1 JSON backups are never rewritten by translation.

Map labels prefer Simplified Chinese, then other Chinese names supplied by
OpenFreeMap, then English or local names. Some map labels may therefore retain
Traditional Chinese or their original language. The map provider's attribution is
preserved in both languages and image exports.

### Maintaining translations

App messages live in `src/locales/en.ts` and `src/locales/zh-Hans.ts`. Use semantic
keys, whole sentences, and i18next interpolation/plural forms rather than joining
translated fragments. Type checking and catalog tests check message coverage and
interpolation variables. Render errors from the stable codes in `src/errors.ts` so
visible errors follow language changes.

Airport translations have a separate, explicit update command:

```sh
npm run airports:translate
```

Normal builds do not fetch translations. See [airport data documentation](data/README.md)
for provenance, matching rules, and offline regeneration.
