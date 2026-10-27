# Airport catalog

`airports.json` is the bundled search catalog, including closed airports for historical trips. `airports-source.json` records its source URL, download date, airport count, license, and checksum.

Normal builds use these checked-in files without downloading anything. Vite emits the catalog as a static asset loaded on demand; searches run in the browser.

To refresh from the public-domain OurAirports CSV:

```sh
npm run airports:update
```

Or use a previously downloaded CSV:

```sh
node scripts/update-airports.mjs /path/to/airports.csv
```

Review and commit both generated files, then rebuild the site. Existing flight snapshots are never rewritten.

Source and license: https://ourairports.com/data/ (public domain; no guarantee of accuracy).

## Chinese airport and city names

`airports-zh-Hans.json` is a separate display/search overlay, keyed by the existing
catalog airport IDs. Its metadata records coverage, retrieval time, query templates,
and SHA-256 hashes of the source snapshot and catalog. It does not change canonical
airport names, coordinates, stored flight snapshots, or backup schemas.

The source is [Wikidata](https://www.wikidata.org/), whose structured data is
[CC0](https://www.wikidata.org/wiki/Wikidata:Licensing). The updater uses bounded
queries against its public SPARQL endpoint, with at most two requests in flight.
No user flight data is sent. Normal builds and browser searches never contact
Wikidata.

Matching uses ICAO first, then IATA, and requires exactly one candidate within five
kilometres of the catalog coordinates. Ambiguous or unmatched entries retain their
source names. Municipality translations require a matching English label or alias
of a served-city entity; otherwise the original municipality remains. Other served
cities are useful search aliases without replacing the municipality.

Explicit Simplified Chinese labels take priority. Other Chinese labels and aliases
are converted at update time with [OpenCC](https://github.com/nk2028/opencc-js).
Original Chinese aliases are also searchable. OpenCC is a development dependency
and is not included in the browser bundle. These community translations are not
exhaustive and may contain older airport names.

Update the overlay after refreshing the airport catalog:

```sh
npm run airports:translate
```

To fetch and save the source responses for later reproduction:

```sh
node scripts/update-airport-translations.mjs "" /tmp/airport-translations-source.json
```

To regenerate without network access:

```sh
node scripts/update-airport-translations.mjs /tmp/airport-translations-source.json
```

Failed requests, malformed or incomplete snapshots, fewer than 100 translated
names, or a coverage drop greater than 10% abort the update without replacing the
existing bundle. Review coverage changes and generated data before committing.
Adding a new app locale does not require changing the airport or backup schema.
