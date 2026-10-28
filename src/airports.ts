import history from "../data/airport-history.json";
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

  private searchable: { airport: Airport; text: string }[] = [];
  private namesVersion = -1;
  constructor(airports: Airport[]) {
    this.airports = airports;
    this.updateSearchIndex();
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
          ...history.periods.filter(p => p.airportId === airport.id).flatMap(p => [p.iata, p.icao]),
        ].join(" "),
      ),
    }));
  }
  search(query: string, date?: string | null) {
    if (this.namesVersion !== placeNamesVersion()) this.updateSearchIndex();
    const tokens = normalize(query.trim()).split(/\s+/);
    if (query.trim().length < 2) return [];
    const exact = query.trim().toUpperCase();
    return this.searchable
      .filter((row) => tokens.every((token) => row.text.includes(token)))
      .flatMap<AirportSearchResult>((row) => {
        const periods = history.periods.filter((p) => p.airportId === row.airport.id);
        return periods.length ? periods.map((period) => ({ airport: { ...row.airport, iata: period.iata, icao: period.icao }, period })) : [{ airport: row.airport, period: undefined }];
      })
      .sort((a, b) => {
        const score = ({ airport, period }: AirportSearchResult) =>
          Number([airport.iata, airport.icao, airport.id].includes(exact)) *
            100 +
          (date && date >= history.coverageFrom ? Number(Boolean(period && date >= period.fromDate && (!period.untilDate || date < period.untilDate))) * 10 : Number(!period?.untilDate) * 10) + Number(!airport.closed);
        return score(b) - score(a) || a.airport.name.localeCompare(b.airport.name);
      })
      .slice(0, 20);
  }
}

let catalog: Promise<AirportCatalog> | undefined;
export function searchAirports(query: string, date?: string | null) {
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
    value.search(query, date),
  );
}

export type AirportSearchResult = { airport: Airport; period?: (typeof history.periods)[number] };
