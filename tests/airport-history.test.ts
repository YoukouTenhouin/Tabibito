import { describe, it, expect, beforeAll } from "vitest";
import airports from "../data/airports.json";
import history from "../data/airport-history.json";
import { AirportCatalog } from "../src/airports";
import { airportSchema, flightInputSchema } from "../src/shared";
import { loadPlaceNames } from "../src/places";
import names from "../data/airports-zh-Hans.json";
import { input } from "./fixtures";
const catalog = new AirportCatalog(airportSchema.array().parse(airports));
beforeAll(() => loadPlaceNames(async () => new Response(JSON.stringify(names))));
describe("historical airport selection", () => {
  it.each([
    ["TAO", "2021-08-12", "CN-0164", "ZSQD"],
    ["CAN", "2004-08-05", "CN-0001", "ZGGG"],
    ["KMG", "2012-06-28", "CN-0032", "ZPPP"],
    ["SWA", "2011-12-15", "CN-0036", "ZGOW"],
    ["HKG", "1998-07-06", "HK-0099", "VHHH"],
  ])("ranks %s across its transition", (code, date, old, current) => {
    const previous = new Date(Date.parse(date) - 86400000).toISOString().slice(0,10);
    const next = new Date(Date.parse(date) + 86400000).toISOString().slice(0,10);
    expect(catalog.search(code, previous)[0].airport.id).toBe(old);
    expect(catalog.search(code, next)[0].airport.id).toBe(current);
    expect(catalog.search(code)[0].airport.id).toBe(current);
    expect(catalog.search(code, date).map(r => r.airport.id)).toContain(old);
  });
  it("retains physical identity while applying historical Istanbul codes", () => {
    const old = catalog.search("IST", "2010-01-01")[0].airport;
    expect(old.id).toBe("LTBA");
    expect(old.iata).toBe("IST");
    expect(catalog.search("ISL", "2020-01-01")[0].airport.id).toBe("LTBA");
  });
  it("supports Chinese searches, snapshot validation and distinct coordinates", () => {
    const old = catalog.search("流亭", "2020-01-01")[0].airport;
    const current = catalog.search("TAO", "2022-01-01")[0].airport;
    expect(old.id).toBe("CN-0164");
    expect(old.longitude).not.toBe(current.longitude);
    expect(flightInputSchema.parse({...input, origin:old}).origin).toEqual(old);
    expect(catalog.search("TAO", "1980-01-01").some(r => r.airport.id === old.id)).toBe(true);
  });
  it("has valid, sourced periods pointing to distinct catalog identities", () => {
    expect(new Set(airports.map(a => a.id)).size).toBe(airports.length);
    for (const period of history.periods) {
      expect(airports.some(a => a.id === period.airportId)).toBe(true);
      expect(period.source).toMatch(/^https:\/\//);
      if(period.untilDate) expect(period.fromDate < period.untilDate).toBe(true);
    }
  });
});
