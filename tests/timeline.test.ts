import { describe, expect, it } from "vitest";
import { advanceTimeline, prepareTimelineRoute, timelineDates, timelineRouteFrame } from "../src/timeline";
import type { Flight } from "../src/shared";
import { input, hnd, sfo, lhr, prg } from "./fixtures";
import { routeFeatures } from "../src/geometry";
const flight = (overrides: Partial<Flight> = {}): Flight => ({ ...input, id: "a", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z", ...overrides });

describe("timeline dates and clock", () => {
  it("sorts distinct dates inclusively, skipping undated flights and calendar gaps", () => {
    const flights = [flight({ date: null }), flight({ date: "2025-01-01" }), flight(), flight(), flight({ date: "2023-01-01" })];
    expect(timelineDates(flights, "2024-07-09", "2025-01-01")).toEqual(["2024-07-09", "2025-01-01"]);
    expect(timelineDates(flights, "2024-07-09", "2024-07-09")).toEqual(["2024-07-09"]);
    expect(timelineDates(flights, "2024-01-01", "2024-02-01")).toEqual([]);
    expect(timelineDates(flights, "invalid", "2025-01-01")).toEqual([]);
    expect(timelineDates(flights, "2025-01-01", "2024-01-01")).toEqual([]);
  });
  it("advances at two seconds per date, respecting speed and completion", () => {
    expect(advanceTimeline(0, 1000, 0.5, 3)).toBe(0.25);
    expect(advanceTimeline(0.25, 1000, 1, 3)).toBe(0.75);
    expect(advanceTimeline(0.75, 1000, 2, 3)).toBe(1.75);
    expect(advanceTimeline(1.75, 10000, 2, 3)).toBe(3);
    expect(advanceTimeline(1, 0, 1, 3)).toBe(1);
    expect(advanceTimeline(0, 1000, 1, 0)).toBe(0);
  });
});

describe("progressive geometry", () => {
  it("follows the directional bend and finishes on the static route in both directions", () => {
    const west = { ...prg, longitude: -20, latitude: 0 };
    const east = { ...lhr, longitude: 20, latitude: 0 };
    for (const [origin, destination, side] of [[west, east, -1], [east, west, 1]] as const) {
      const f = flight({ origin, destination });
      const prepared = prepareTimelineRoute(f);
      const frame = timelineRouteFrame(prepared, 0.5);
      const geometry = frame.routes.features[0].geometry;
      const points = geometry.type === "LineString" ? geometry.coordinates : geometry.coordinates.flat();
      expect(points.at(-1)![1] * side).toBeGreaterThan(3);
      expect(timelineRouteFrame(prepared, 1).routes).toEqual(routeFeatures([f]));
    }
  });
  it("starts empty, draws stops by distance, and finishes with the original geometry", () => {
    const route = prepareTimelineRoute(flight({ origin: prg, stops: [lhr], destination: sfo }));
    expect(timelineRouteFrame(route, 0).routes.features).toHaveLength(0);
    expect(timelineRouteFrame(route, 0).airportIds.size).toBe(0);
    const firstLegEnd = route.ends[1] / route.total;
    expect(firstLegEnd).toBeLessThan(0.5);
    expect([...timelineRouteFrame(route, firstLegEnd / 2).airportIds]).toEqual([prg.id]);
    expect([...timelineRouteFrame(route, firstLegEnd + 0.01).airportIds]).toEqual([prg.id, lhr.id]);
    expect(timelineRouteFrame(route, 1).routes).toEqual(route.geometry);
    expect([...timelineRouteFrame(route, 1).airportIds]).toEqual([prg.id, lhr.id, sfo.id]);
    const partial = timelineRouteFrame(route, 0.5).routes;
    expect(JSON.stringify(partial)).not.toBe(JSON.stringify(route.geometry));
  });
  it("preserves split lines across the Pacific and does not connect their endpoints", () => {
    const route = prepareTimelineRoute(flight({ origin: hnd, destination: sfo }));
    expect(route.parts.length).toBeGreaterThan(1);
    for (const progress of [0.1, 0.5, 0.9, 1]) {
      for (const feature of timelineRouteFrame(route, progress).routes.features) {
        const lines = feature.geometry.type === "LineString" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
        for (const line of lines) for (let i = 1; i < line.length; i++)
          expect(Math.abs(line[i][0] - line[i - 1][0])).toBeLessThan(180);
      }
    }
  });
  it("handles antipodal and coincident airport coordinates without NaNs", () => {
    for (const destination of [{ ...sfo, latitude: -prg.latitude, longitude: prg.longitude - 180 }, { ...lhr, latitude: prg.latitude, longitude: prg.longitude }]) {
      const route = prepareTimelineRoute(flight({ destination }));
      for (const progress of [0, 0.25, 0.75, 1]) {
        const frame = timelineRouteFrame(route, progress);
        expect(JSON.stringify(frame.routes)).not.toMatch(/NaN|null/);
      }
      expect(timelineRouteFrame(route, 1).airportIds.has(destination.id)).toBe(true);
    }
  });
});
