import { describe, expect, it } from "vitest";
import {
  flightDistanceKm,
  totalFlightDistance,
  formatDistance,
} from "../src/distance";
import { prg, lhr } from "./fixtures";
const route = (lat1: number, lon1: number, lat2: number, lon2: number) => ({
  origin: { ...prg, latitude: lat1, longitude: lon1 },
  destination: { ...lhr, latitude: lat2, longitude: lon2 },
});

describe("estimated flight distances", () => {
  it("handles coincident points, a quarter circumference and antipodes", () => {
    expect(flightDistanceKm(route(20, 30, 20, 30))).toBe(0);
    expect(flightDistanceKm(route(0, 0, 0, 90))).toBeCloseTo(10007.5572, 3);
    expect(flightDistanceKm(route(0, 0, 0, 180))).toBeCloseTo(20015.1144, 3);
  });
  it("takes the short route across the date line and is symmetric", () => {
    expect(flightDistanceKm(route(0, 179, 0, -179))).toBeCloseTo(222.3902, 3);
    expect(flightDistanceKm({ origin: prg, destination: lhr })).toBeCloseTo(
      flightDistanceKm({ origin: lhr, destination: prg }),
      8,
    );
  });
  it("counts repeated flights, converts statute miles and rounds only for display", () => {
    expect(totalFlightDistance([])).toEqual({ km: 0, miles: 0 });
    const flight = route(0, 0, 0, 1);
    const total = totalFlightDistance([flight, flight]);
    expect(total.km).toBeCloseTo(222.3902, 3);
    expect(total.miles).toBeCloseTo(138.1868, 3);
    expect(formatDistance(total.km)).toBe("222");
    expect(formatDistance(12345.6)).toBe("12,346");
  });
});
