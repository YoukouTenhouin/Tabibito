import { AppError } from "./errors";
import {
  airportSearchNames,
  loadPlaceNames,
  placeNamesVersion,
} from "./places";
import { airportSchema, type Airport } from "./shared";

const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
export class AirportCatalog {
  readonly airports: Airport[];
  private codes = new Map<string, Airport>();
  private searchable: { airport: Airport; text: string }[] = [];
  private namesVersion = -1;
  constructor(airports: Airport[]) {
    this.airports = airports;
    this.updateSearchIndex();
    // Prefer currently operating airports when a historic code has been reused.
    for (const airport of [...airports].sort(
      (a, b) => Number(b.closed) - Number(a.closed),
    )) {
      for (const code of [airport.id, airport.iata, airport.icao])
        if (code) this.codes.set(code.toUpperCase(), airport);
    }
  }
  private updateSearchIndex() {
    this.namesVersion = placeNamesVersion();
    this.searchable = this.airports.map((airport) => ({
      airport,
      text: normalize(
        [
          airport.id,
          airport.iata,
          airport.icao,
          airport.name,
          airport.city,
          airport.country,
          ...airportSearchNames(airport),
        ].join(" "),
      ),
    }));
  }
  byCode(code: string | undefined | null) {
    return code ? this.codes.get(code.toUpperCase()) : undefined;
  }
  search(query: string) {
    if (this.namesVersion !== placeNamesVersion()) this.updateSearchIndex();
    const tokens = normalize(query.trim()).split(/\s+/);
    if (query.trim().length < 2) return [];
    const exact = query.trim().toUpperCase();
    return this.searchable
      .filter((row) => tokens.every((token) => row.text.includes(token)))
      .map((row) => row.airport)
      .sort((a, b) => {
        const score = (airport: Airport) =>
          Number([airport.iata, airport.icao, airport.id].includes(exact)) *
            10 +
          Number(!airport.closed);
        return score(b) - score(a) || a.name.localeCompare(b.name);
      })
      .slice(0, 20);
  }
}

let catalog: Promise<AirportCatalog> | undefined;
export function searchAirports(query: string) {
  catalog ??= fetch(new URL("../data/airports.json", import.meta.url))
    .then(async (response) => {
      if (!response.ok) throw new AppError("errors.catalog");
      return new AirportCatalog(
        airportSchema
          .array()
          .min(1)
          .parse(await response.json()),
      );
    })
    .catch((error) => {
      catalog = undefined;
      throw new AppError("errors.catalog", { cause: error });
    });
  return Promise.all([catalog, loadPlaceNames()]).then(([value]) =>
    value.search(query),
  );
}
