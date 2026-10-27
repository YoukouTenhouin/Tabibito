import { z } from "zod";

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
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date in YYYY-MM-DD format.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Enter a valid calendar date.");

export const flightNumberSchema = z
  .string()
  .max(20)
  .transform((value) => value.replace(/\s+/g, "").toUpperCase())
  .pipe(
    z
      .string()
      .regex(
        /^(?:[A-Z0-9]{2}|[A-Z]{3})\d{1,4}[A-Z]?$/,
        "Use an airline code and flight number, for example BA249 or U21234.",
      ),
  );

const flightFields = {
  date: dateSchema.nullable(),
  flightNumber: flightNumberSchema.nullable(),
  origin: airportSchema,
  destination: airportSchema,
};
const differentAirports = (value: { origin: Airport; destination: Airport }) =>
  value.origin.id !== value.destination.id;
export const flightInputSchema = z
  .object(flightFields)
  .strict()
  .refine(
    differentAirports,
    "Choose different departure and arrival airports.",
  );
export const flightSchema = z
  .object({
    ...flightFields,
    id: z.uuid(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .refine(
    differentAirports,
    "Choose different departure and arrival airports.",
  );
export const backupSchema = z
  .object({
    app: z.literal("tabibito"),
    version: z.literal(1),
    exportedAt: z.iso.datetime(),
    flights: z.array(flightSchema).max(10_000),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.flights.map((flight) => flight.id)).size ===
      value.flights.length,
    "Backup contains duplicate flight IDs.",
  );
export type Airport = z.infer<typeof airportSchema>;
export type FlightInput = z.infer<typeof flightInputSchema>;
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
      ...[flight.origin, flight.destination].flatMap((a) => [
        a.name,
        a.city,
        a.country,
        a.iata,
        a.icao,
      ]),
    ]
      .join(" ")
      .toLocaleLowerCase();
    return text.includes(query);
  });
}
