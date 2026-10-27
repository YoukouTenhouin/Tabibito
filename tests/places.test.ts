import { beforeAll, describe, expect, it } from "vitest";
import {
  airportCity,
  airportName,
  countryName,
  loadPlaceNames,
} from "../src/places";
import { AirportCatalog } from "../src/airports";
import { filteredFlights } from "../src/shared";
import { airports, input, lhr, prg } from "./fixtures";
import bundled from "../data/airports-zh-Hans.json";

const earlyCatalog = new AirportCatalog(airports);
beforeAll(() =>
  loadPlaceNames(async () => new Response(JSON.stringify(bundled))),
);

describe("localized place display and search", () => {
  it("uses bundled Chinese names and leaves canonical airport snapshots intact", () => {
    const original = structuredClone(lhr);
    expect(airportName(lhr, "zh-Hans")).toMatch(/希思罗/);
    expect(airportCity(lhr, "zh-Hans")).toBe("伦敦");
    expect(airportName(lhr, "en")).toBe(lhr.name);
    expect(lhr).toEqual(original);
    expect(countryName("GB", "zh-Hans")).toBe("英国 (GB)");
  });
  it("falls back for unknown, relocated or differently named historical snapshots", () => {
    expect(airportName({ ...lhr, id: "unknown" }, "zh-Hans")).toBe(lhr.name);
    expect(airportName({ ...lhr, latitude: 0 }, "zh-Hans")).toBe(lhr.name);
    expect(
      airportCity({ ...lhr, city: "Historic municipality" }, "zh-Hans"),
    ).toBe("Historic municipality");
  });
  it("finds Chinese and original names and codes without changing airport identity", () => {
    const catalog = new AirportCatalog(airports);
    expect(catalog.search("希思罗")).toContainEqual(lhr);
    expect(catalog.search("伦敦")).toContainEqual(lhr);
    expect(catalog.search("布拉格")).toContainEqual(prg);
    expect(catalog.search("London")).toContainEqual(lhr);
    expect(catalog.search("LHR")[0]).toEqual(lhr);
    expect(earlyCatalog.search("希思罗")).toContainEqual(lhr);
    const flight = { ...input, id: "test", createdAt: "", updatedAt: "" };
    expect(filteredFlights([flight], "伦敦", "2024")).toEqual([flight]);
    expect(filteredFlights([flight], "布拉格", "2023")).toEqual([]);
  });
});
