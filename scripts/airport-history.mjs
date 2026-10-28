import { readFileSync } from "node:fs";
import { z } from "zod";
const date = z.iso.date();
const airport = z.object({
  id: z.string().min(1), name: z.string().min(1), city: z.string(),
  country: z.string().length(2), iata: z.string().length(3), icao: z.string().length(4),
  latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), closed: z.boolean(),
});
export const history = z.object({
  coverageFrom: date,
  facilities: z.array(z.object({airport, zhName: z.string().min(1), source: z.url()})),
  periods: z.array(z.object({airportId: z.string(), iata: z.string().length(3), icao: z.string().length(4), fromDate: date, untilDate: date.nullable(), source: z.url()}).refine(p => !p.untilDate || p.fromDate < p.untilDate)),
}).parse(JSON.parse(readFileSync(new URL('../data/airport-history.json', import.meta.url), 'utf8')));
export function addHistoricalAirports(airports) {
  const result = [...airports];
  for (const {airport} of history.facilities) {
    const index = result.findIndex(a => a.id === airport.id);
    if (index >= 0) {
      const existing = result[index];
      if (Math.abs(existing.latitude - airport.latitude) > .05 || Math.abs(existing.longitude - airport.longitude) > .05) throw new Error(`Historical airport identity moved: ${airport.id}`);
      result[index] = airport;
    } else result.push(airport);
  }
  if (new Set(result.map(a => a.id)).size !== result.length) throw new Error('Duplicate airport identity');
  return result;
}
export function addHistoricalTranslations(translations) {
  for (const {airport: a, zhName} of history.facilities) translations[a.id] = {
    name: zhName, aliases: [zhName], latitude: a.latitude, longitude: a.longitude, sourceCity: a.city,
  };
  return translations;
}
