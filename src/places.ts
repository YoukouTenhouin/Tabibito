import type { Airport } from "./shared";
import type { Locale } from "./i18n";
import { flightDistanceKm } from "./distance";
import { z } from "zod";

type AirportTranslation = {
  name?: string;
  city?: string;
  aliases: string[];
  latitude: number;
  longitude: number;
  sourceCity: string;
};
let translations: Readonly<Record<string, AirportTranslation>> = {};
let loaded = false;
let pending: Promise<void> | undefined;
const listeners = new Set<() => void>();
const namesSchema = z.object({
  airports: z.record(
    z.string(),
    z.object({
      name: z.string().optional(),
      city: z.string().optional(),
      aliases: z.array(z.string()),
      sourceCity: z.string(),
      latitude: z.number().finite().min(-90).max(90),
      longitude: z.number().finite().min(-180).max(180),
    }),
  ),
});

export const placeNamesVersion = () => Number(loaded);
export function subscribePlaceNames(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Load once, outside the initial JS bundle. Original names remain usable on failure. */
export function loadPlaceNames(fetcher: typeof fetch = fetch): Promise<void> {
  if (loaded) return Promise.resolve();
  pending ??= fetcher(
    new URL("../data/airports-zh-Hans.json", import.meta.url),
    {
      signal: AbortSignal.timeout(10000),
    },
  )
    .then(async (response) => {
      if (!response.ok) throw new Error("Place names unavailable");
      translations = namesSchema.parse(await response.json()).airports;
      loaded = true;
      for (const listener of listeners) listener();
    })
    .catch(() => {
      pending = undefined;
    });
  return pending;
}
const countries = {
  en: new Intl.DisplayNames("en", { type: "region" }),
  "zh-Hans": new Intl.DisplayNames("zh-Hans", { type: "region" }),
};

function translation(airport: Airport) {
  const entry = translations[airport.id];
  if (!entry) return undefined;
  const distance = flightDistanceKm({
    origin: airport,
    destination: { ...airport, ...entry },
  });
  return distance <= 5 ? entry : undefined;
}

export function airportName(airport: Airport, locale: Locale) {
  return (
    (locale === "zh-Hans" ? translation(airport)?.name : undefined) ||
    airport.name
  );
}

export function airportCity(airport: Airport, locale: Locale) {
  const entry = locale === "zh-Hans" ? translation(airport) : undefined;
  return (
    (entry?.sourceCity === airport.city ? entry.city : undefined) ||
    airport.city
  );
}

export function countryName(code: string, locale: Locale) {
  try {
    const name = countries[locale].of(code.toUpperCase());
    return name && name !== code ? `${name} (${code})` : code;
  } catch {
    return code;
  }
}

/** Both languages are indexed, irrespective of the interface language. */
export function airportSearchNames(airport: Airport): string[] {
  const entry = translation(airport);
  return [
    entry?.name ?? "",
    entry?.city ?? "",
    ...(entry?.aliases ?? []),
    countryName(airport.country, "en"),
    countryName(airport.country, "zh-Hans"),
  ];
}
