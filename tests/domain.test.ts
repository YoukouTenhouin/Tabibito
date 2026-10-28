import { describe, expect, it } from "vitest";
import {
  backupSchema,
  dateSchema,
  filteredFlights,
  flightInputSchema,
  flightNumberSchema,
  type Flight,
} from "../src/shared";
import { AirportCatalog } from "../src/airports";
import { airports, input, prg } from "./fixtures";

const flight: Flight = {
  ...input,
  id: "6dd610ed-b54d-4aa9-a322-25ea87b81508",
  createdAt: "2024-07-10T00:00:00.000Z",
  updatedAt: "2024-07-10T00:00:00.000Z",
};
describe("flight records and portable backups", () => {
  it("accepts date-only leap days and rejects impossible dates", () => {
    expect(dateSchema.parse("2024-02-29")).toBe("2024-02-29");
    for (const date of [
      "2023-02-29",
      "2024-02-30",
      "2024-13-01",
      "July 9 2024",
      "2024-07-09T10:00:00Z",
    ])
      expect(dateSchema.safeParse(date).success).toBe(false);
  });
  it("normalizes flight numbers without losing leading zeros", () => {
    expect(flightNumberSchema.parse(" ba 008 ")).toBe("BA008");
    expect(flightNumberSchema.parse("u2 1234")).toBe("U21234");
    expect(flightNumberSchema.parse("aal 6")).toBe("AAL6");
    expect(flightNumberSchema.safeParse("hello").success).toBe(false);
    expect(flightNumberSchema.safeParse("BA12345").success).toBe(false);
  });
  it("supports undated manual entries but rejects invalid airports and identical endpoints", () => {
    expect(
      flightInputSchema.parse({ ...input, date: null, flightNumber: null })
        .date,
    ).toBeNull();
    expect(
      flightInputSchema.safeParse({ ...input, destination: prg }).success,
    ).toBe(false);
    expect(
      flightInputSchema.safeParse({
        ...input,
        origin: { ...prg, latitude: 91 },
      }).success,
    ).toBe(false);
    expect(
      flightInputSchema.safeParse({
        ...input,
        origin: { ...prg, longitude: NaN },
      }).success,
    ).toBe(false);
  });
  it("round-trips airport snapshots without a provider or catalog", () => {
    const backup = {
      app: "tabibito",
      version: 1,
      exportedAt: "2026-10-27T00:00:00.000Z",
      flights: [flight],
    };
    expect(backupSchema.parse(JSON.parse(JSON.stringify(backup)))).toEqual(
      backup,
    );
    expect(backupSchema.safeParse({ ...backup, version: 2 }).success).toBe(
      false,
    );
    expect(
      backupSchema.safeParse({ ...backup, flights: [flight, flight] }).success,
    ).toBe(false);
    expect(
      backupSchema.safeParse({ ...backup, secret: "never accepted" }).success,
    ).toBe(false);
  });
  it("filters by year, undated status, city and flight number", () => {
    const records = [
      flight,
      { ...flight, id: "6dd610ed-b54d-4aa9-a322-25ea87b81509", date: null },
    ];
    expect(filteredFlights(records, "london", "2024")).toEqual([flight]);
    expect(filteredFlights(records, "ba853", "undated")).toEqual([records[1]]);
    expect(filteredFlights(records, "", "2023")).toEqual([]);
    expect(filteredFlights(records, "HND", "")).toEqual([]);
  });
});
describe("airport search", () => {
  const catalog = new AirportCatalog(airports);
  it("finds airports by IATA, ICAO, city and accent-insensitive names", () => {
    for (const query of ["PRG", "lkpr", "Prague", "vaclav"])
      expect(catalog.search(query)[0]?.airport).toEqual(prg);
    expect(catalog.search("")).toEqual([]);
    expect(catalog.search("nonexistent airport")).toEqual([]);
  });
});
