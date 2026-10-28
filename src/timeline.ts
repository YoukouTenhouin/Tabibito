import type { FeatureCollection, LineString, MultiLineString, Position } from "geojson";
import { routeFeatures } from "./geometry";
import { dateSchema, routeAirports, type Flight } from "./shared";

export function timelineDates(flights: Flight[], start: string, end: string) {
  if (!dateSchema.safeParse(start).success || !dateSchema.safeParse(end).success || start > end) return [];
  return [...new Set(flights.flatMap(f => f.date && f.date >= start && f.date <= end ? [f.date] : []))].sort();
}

export function advanceTimeline(position: number, elapsedMs: number, speed: number, dates: number) {
  return Math.min(dates, position + Math.max(0, elapsedMs) * speed / 2000);
}

function arcLength(a: Position, b: Position) {
  const rad = Math.PI / 180;
  const h = Math.sin((b[1] - a[1]) * rad / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin((b[0] - a[0]) * rad / 2) ** 2;
  return 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function prepareTimelineRoute(flight: Flight) {
  const geometry = routeFeatures([flight]);
  let total = 0;
  const ends: number[] = [0];
  const parts = geometry.features.flatMap(feature => {
    const lines = feature.geometry.type === "LineString" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    const prepared = lines.map(coordinates => {
      const lengths = coordinates.map((point, i) => i ? arcLength(coordinates[i - 1], point) : 0);
      const start = total;
      total += lengths.reduce((sum, length) => sum + length, 0);
      return { coordinates, lengths, start };
    });
    ends.push(total);
    return prepared;
  });
  return { flight, geometry, parts, total, ends };
}
export type TimelineRoute = ReturnType<typeof prepareTimelineRoute>;

/** Slice each split line independently: never connect across the antimeridian. */
export function timelineRouteFrame(route: TimelineRoute, progress: number): {
  routes: FeatureCollection<LineString | MultiLineString>; airportIds: Set<string>;
} {
  const fraction = Math.max(0, Math.min(1, progress));
  const distance = fraction * route.total;
  const airports = routeAirports(route.flight);
  const airportIds = new Set(airports.filter((_, i) => fraction > 0 && (fraction === 1 || route.ends[i] <= distance)).map(a => a.id));
  if (fraction === 1) return { routes: route.geometry, airportIds };
  const lines: Position[][] = [];
  if (fraction > 0) for (const part of route.parts) {
    let remaining = distance - part.start;
    if (remaining < 0) break;
    const coordinates: Position[] = [part.coordinates[0]];
    for (let i = 1; i < part.coordinates.length; i++) {
      const length = part.lengths[i];
      if (remaining >= length) {
        coordinates.push(part.coordinates[i]);
        remaining -= length;
      } else {
        const a = part.coordinates[i - 1], b = part.coordinates[i];
        const ratio = length ? remaining / length : 1;
        if (ratio > 0) coordinates.push([a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio]);
        break;
      }
    }
    if (coordinates.length >= 2) lines.push(coordinates);
  }
  return {
    routes: { type: "FeatureCollection", features: lines.length ? [{ type: "Feature", properties: { id: route.flight.id }, geometry: { type: "MultiLineString", coordinates: lines } }] : [] },
    airportIds,
  };
}
