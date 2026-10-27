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
