import { describe, expect, it } from "vitest";
import { airportFeatures, routeBounds, routeFeatures } from "../src/geometry";
import type { Flight } from "../src/shared";
import { input, hnd, sfo, lhr, prg } from "./fixtures";
const flight: Flight = {
  ...input,
  id: "6dd610ed-b54d-4aa9-a322-25ea87b81508",
  createdAt: "2024-07-10T00:00:00.000Z",
  updatedAt: "2024-07-10T00:00:00.000Z",
};
describe("route geometry", () => {
  it("bends outbound and return flights to the right with exact endpoints", () => {
    const origin = { ...prg, longitude: -20, latitude: 0 };
    const destination = { ...lhr, longitude: 20, latitude: 0 };
    const outbound = { ...flight, origin, destination };
    const inbound = { ...flight, id: "return", origin: destination, destination: origin };
    const [out, back] = routeFeatures([outbound, inbound]).features;
    expect(out.geometry.type).toBe("LineString");
    expect(back.geometry.type).toBe("LineString");
    if (out.geometry.type !== "LineString" || back.geometry.type !== "LineString") return;
    expect(out.geometry.coordinates[0]).toEqual([-20, 0]);
    expect(out.geometry.coordinates.at(-1)).toEqual([20, 0]);
    expect(back.geometry.coordinates[0]).toEqual([20, 0]);
    expect(back.geometry.coordinates.at(-1)).toEqual([-20, 0]);
    expect(out.geometry.coordinates[63][1]).toBeCloseTo(-3.2, 2);
    expect(back.geometry.coordinates[63][1]).toBeCloseTo(3.2, 2);
    for (const point of out.geometry.coordinates.slice(1, -1)) expect(point[1]).toBeLessThan(0);
    for (const point of back.geometry.coordinates.slice(1, -1)) expect(point[1]).toBeGreaterThan(0);
    expect(routeFeatures([inbound, outbound]).features).toEqual([back, out]);
    expect(routeFeatures([outbound]).features).toEqual([out]);
    expect(routeFeatures([inbound]).features).toEqual([back]);
    const bounds = routeBounds([outbound, inbound])!;
    expect(bounds[0][1]).toBeLessThan(-3);
    expect(bounds[1][1]).toBeGreaterThan(3);
  });

  it("keeps polar, antipodal, coincident and date-line endpoint routes finite and split", () => {
    for (const [start, end] of [
      [[0, 80], [180, 80]],
      [[0, 0], [180, 0]],
      [[0, 90], [0, -90]],
      [[14, 50], [14, 50]],
      [[180, 30], [-150, 40]],
      [[-180, 30], [150, 40]],
      [[180, 30], [-180, 30]],
      [[14, 50], [-165.999999999, -50]],
    ]) {
      for (const [a, b] of [[start, end], [end, start]]) {
        const route = { ...flight,
          origin: { ...prg, longitude: a[0], latitude: a[1] },
          destination: { ...lhr, longitude: b[0], latitude: b[1] },
        };
        const geometry = routeFeatures([route]).features[0].geometry;
        const lines = geometry.type === "LineString" ? [geometry.coordinates] : geometry.coordinates;
        expect(lines[0][0]).toEqual(a);
        expect(lines.at(-1)!.at(-1)).toEqual(b);
        for (const line of lines) for (let i = 0; i < line.length; i++) {
          expect(line[i].every(Number.isFinite)).toBe(true);
          expect(Math.abs(line[i][1])).toBeLessThanOrEqual(90);
          if (i) expect(Math.abs(line[i][0] - line[i - 1][0])).toBeLessThanOrEqual(180);
        }
      }
    }
  });

  it("applies the same curve to each stopover leg and retains the parent ID", () => {
    const route = { ...flight, origin: prg, stops: [lhr], destination: sfo };
    const legs = routeFeatures([route]).features;
    expect(legs.map(leg => leg.properties?.id)).toEqual([flight.id, flight.id]);
    expect(legs).toEqual([
      ...routeFeatures([{ ...flight, origin: prg, destination: lhr }]).features,
      ...routeFeatures([{ ...flight, origin: lhr, destination: sfo }]).features,
    ]);
  });
  it("handles short and transatlantic routes with exact endpoints", () => {
    for (const route of [
      flight,
      { ...flight, origin: lhr, destination: sfo },
    ]) {
      const geometry = routeFeatures([route]).features[0].geometry;
      expect(geometry.type).toBe("LineString");
      expect(geometry.coordinates[0]).toEqual([
        route.origin.longitude,
        route.origin.latitude,
      ]);
      expect(geometry.coordinates.at(-1)).toEqual([
        route.destination.longitude,
        route.destination.latitude,
      ]);
    }
  });
  it("splits a Pacific route at the date line and uses narrow bounds", () => {
    const route = { ...flight, origin: hnd, destination: sfo };
    const geometry = routeFeatures([route]).features[0].geometry;
    expect(geometry.type).toBe("MultiLineString");
    if (geometry.type === "MultiLineString")
      for (const line of geometry.coordinates)
        for (let i = 1; i < line.length; i++)
          expect(Math.abs(line[i][0] - line[i - 1][0])).toBeLessThan(180);
    const bounds = routeBounds([route])!;
    expect(bounds[1][0] - bounds[0][0]).toBeLessThan(120);
  });
  it("keeps repeat flights while deduplicating markers", () => {
    const flights = [flight, { ...flight, id: "another-flight" }];
    expect(routeFeatures(flights).features).toHaveLength(2);
    expect(airportFeatures(flights).features).toHaveLength(2);
    expect(routeBounds([])).toBeNull();
  });
});
