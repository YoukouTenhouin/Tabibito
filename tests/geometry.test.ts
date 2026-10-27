import { describe, expect, it } from "vitest";
import { airportFeatures, routeBounds, routeFeatures } from "../src/geometry";
import type { Flight } from "../src/shared";
import { input, hnd, sfo, lhr } from "./fixtures";
const flight: Flight = {
  ...input,
  id: "6dd610ed-b54d-4aa9-a322-25ea87b81508",
  createdAt: "2024-07-10T00:00:00.000Z",
  updatedAt: "2024-07-10T00:00:00.000Z",
};
describe("route geometry", () => {
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
