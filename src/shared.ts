import { z } from "zod";
import { airportSearchNames } from "./places";

export const airportSchema = z
  .object({
    id: z.string().min(1).max(32),
    name: z.string().min(1).max(250),
    city: z.string().max(150),
    country: z.string().length(2),
    iata: z
      .string()
      .regex(/^[A-Z0-9]{3}$/)
      .nullable(),
    icao: z
      .string()
      .regex(/^[A-Z0-9]{4}$/)
      .nullable(),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    closed: z.boolean(),
  })
  .strict();

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "errors.dateFormat")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "errors.dateInvalid");

export const flightNumberSchema = z
  .string()
  .max(20)
  .transform((value) => value.replace(/\s+/g, "").toUpperCase())
  .pipe(
    z
      .string()
      .regex(/^(?:[A-Z0-9]{2}|[A-Z]{3})\d{1,4}[A-Z]?$/, "errors.flightNumber"),
  );

const flightFields = {
  date: dateSchema.nullable(),
  flightNumber: flightNumberSchema.nullable(),
  origin: airportSchema,
  destination: airportSchema,
  stops: z.array(airportSchema).default([]),
};
const differentAirports = (value: { origin: Airport; destination: Airport; stops?: Airport[] }) =>
  value.origin.id !== value.destination.id &&
  routeAirports(value).every((airport, index, all) => index === 0 || airport.id !== all[index - 1].id);
export const flightInputSchema = z
  .object(flightFields)
  .strict()
  .refine(differentAirports, "errors.differentAirports");
export const flightSchema = z
  .object({
    ...flightFields,
    id: z.uuid(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .refine(differentAirports, "errors.differentAirports");
const legacyFlightSchema = z.object({ ...flightFields, stops: z.never().optional(), id: z.uuid(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() }).strict().refine(differentAirports, "errors.differentAirports");
export const backupSchema = z
  .object({
    app: z.literal("tabibito"),
    version: z.union([z.literal(1), z.literal(2)]),
    exportedAt: z.iso.datetime(),
    flights: z.array(z.unknown()).max(10_000),
  })
  .strict()
  .transform((value, ctx) => {
    const parsed = z.array(value.version === 1 ? legacyFlightSchema : flightSchema.safeExtend({ stops: z.array(airportSchema) })).safeParse(value.flights);
    if (!parsed.success) { ctx.addIssue({ code: "custom", message: "errors.backupInvalid" }); return z.NEVER; }
    return { ...value, version: 2 as const, flights: parsed.data.map(flight => flightSchema.parse(flight)) };
  })
  .refine(
    (value) =>
      new Set(value.flights.map((flight) => flight.id)).size ===
      value.flights.length,
    "errors.duplicateFlights",
  );
export type Airport = z.infer<typeof airportSchema>;
export type FlightInput = z.input<typeof flightInputSchema>;
export type Flight = z.infer<typeof flightSchema>;
export type Backup = z.infer<typeof backupSchema>;
export const airportCode = (airport: Airport) =>
  airport.iata || airport.icao || airport.id;

export function filteredFlights(
  flights: Flight[],
  search: string,
  year: string,
) {
  const query = search.trim().toLocaleLowerCase();
  return flights.filter((flight) => {
    if (
      year === "undated"
        ? flight.date !== null
        : year && !flight.date?.startsWith(year)
    )
      return false;
    const text = [
      flight.flightNumber,
      flight.date,
      ...routeAirports(flight).flatMap((a) => [
        a.name,
        a.city,
        a.country,
        a.iata,
        a.icao,
        ...airportSearchNames(a),
      ]),
    ]
      .join(" ")
      .toLocaleLowerCase();
    return text.includes(query);
  });
}

export function routeAirports(route: { origin: Airport; destination: Airport; stops?: Airport[] }): Airport[] { return [route.origin, ...(route.stops ?? []), route.destination]; }
export function routeSegments(route: { origin: Airport; destination: Airport; stops?: Airport[] }) { const airports = routeAirports(route); return airports.slice(1).map((destination, index) => ({ origin: airports[index], destination })); }
