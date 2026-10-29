import type {
  FeatureCollection,
  LineString,
  MultiLineString,
  Point,
} from "geojson";
import { routeSegments, routeAirports, airportCode, type Flight } from "./shared";

type Vector = [number, number, number];
type Coordinate = [number, number];
const radians = Math.PI / 180;
const cross = (a: Vector, b: Vector): Vector => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vector, b: Vector) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const unit = (v: Vector): Vector => {
  const length = Math.hypot(...v);
  return [v[0] / length, v[1] / length, v[2] / length];
};
function sphere([longitude, latitude]: Coordinate): Vector {
  const lat = latitude * radians, lon = longitude * radians;
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
}

/** Split after bending, so neither rendering nor timeline slicing crosses the world. */
function splitDateLine(points: Coordinate[]): LineString | MultiLineString {
  const lines: Coordinate[][] = [[points[0]]];
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1], next = points[i];
    const delta = next[0] - previous[0];
    if (Math.abs(delta) > 180) {
      const boundary = delta > 0 ? -180 : 180;
      const longitude = next[0] + (delta > 0 ? -360 : 360);
      const fraction = longitude === previous[0] ? 0 : (boundary - previous[0]) / (longitude - previous[0]);
      const latitude = previous[1] + fraction * (next[1] - previous[1]);
      lines[lines.length - 1].push([boundary, latitude]);
      lines.push([[-boundary, latitude]]);
    }
    lines[lines.length - 1].push(next);
  }
  return lines.length === 1
    ? { type: "LineString", coordinates: lines[0] }
    : { type: "MultiLineString", coordinates: lines };
}

function directionalArc(start: Coordinate, end: Coordinate): LineString | MultiLineString {
  const a = sphere(start), b = sphere(end);
  let normal = cross(a, b);
  const sine = Math.hypot(...normal);
  const cosine = Math.max(-1, Math.min(1, dot(a, b)));
  const angle = Math.atan2(sine, cosine);
  if (angle < 1e-10) return splitDateLine([start, end]);
  if (sine < 1e-10) {
    // Antipodes have no unique great circle. Choose the same intermediate axis
    // in either direction, including at the poles, then reverse the normal.
    const canonical = start[0] < end[0] || (start[0] === end[0] && start[1] < end[1]) ? a : b;
    const axis: Vector = [0, 0, 0];
    const index = canonical.map(Math.abs).indexOf(Math.min(...canonical.map(Math.abs)));
    axis[index] = 1;
    normal = cross(a, axis);
  }
  normal = unit(normal);
  const tangent = cross(normal, a);
  const bend = Math.min(angle * 0.08, 5 * radians);
  const points: Coordinate[] = [start];
  for (let i = 1; i < 127; i++) {
    const t = i / 127;
    const offset = bend * Math.sin(Math.PI * t);
    // -normal is to the right of travel on the sphere. Reversing the leg
    // reverses this offset without depending on other flights or map state.
    const point = a.map((value, axis) =>
      (value * Math.cos(angle * t) + tangent[axis] * Math.sin(angle * t)) * Math.cos(offset)
        - normal[axis] * Math.sin(offset),
    ) as Vector;
    points.push([
      Math.atan2(point[1], point[0]) / radians,
      Math.atan2(point[2], Math.hypot(point[0], point[1])) / radians,
    ]);
  }
  points.push(end);
  return splitDateLine(points);
}

export function routeFeatures(
  flights: Flight[],
): FeatureCollection<LineString | MultiLineString> {
  return {
    type: "FeatureCollection",
    features: flights.flatMap((parent) => routeSegments(parent).map((segment) => ({
      type: "Feature" as const,
      properties: { id: parent.id },
      geometry: directionalArc(
        [segment.origin.longitude, segment.origin.latitude],
        [segment.destination.longitude, segment.destination.latitude],
      ),
    }))),
  };
}

export function airportFeatures(flights: Flight[]): FeatureCollection<Point> {
  const unique = new Map(
    flights
      .flatMap(routeAirports)
      .map((airport) => [airport.id, airport]),
  );
  return {
    type: "FeatureCollection",
    features: [...unique.values()].map((airport) => ({
      type: "Feature",
      properties: {
        id: airport.id,
        code: airportCode(airport),
        name: airport.name,
      },
      geometry: {
        type: "Point",
        coordinates: [airport.longitude, airport.latitude],
      },
    })),
  };
}

// Find the smallest longitude interval, so Pacific routes don't zoom out to the whole world.
export function routeBounds(
  flights: Flight[],
): [[number, number], [number, number]] | null {
  if (!flights.length) return null;
  const features = routeFeatures(flights).features;
  const coords = features.flatMap((feature) =>
    feature.geometry.type === "LineString"
      ? feature.geometry.coordinates
      : feature.geometry.coordinates.flat(),
  );
  const longitudes = coords
    .map((point) => ((point[0] % 360) + 360) % 360)
    .sort((a, b) => a - b);
  let largestGap = -1,
    start = 0,
    end = 0;
  for (let i = 0; i < longitudes.length; i++) {
    const next =
      longitudes[(i + 1) % longitudes.length] +
      (i === longitudes.length - 1 ? 360 : 0);
    if (next - longitudes[i] > largestGap) {
      largestGap = next - longitudes[i];
      start = next % 360;
      end = longitudes[i];
    }
  }
  if (end < start) end += 360;
  if (start > 180) {
    start -= 360;
    end -= 360;
  }
  let south = 90,
    north = -90;
  for (const point of coords) {
    south = Math.min(south, point[1]);
    north = Math.max(north, point[1]);
  }
  return [
    [start, Math.max(-85, south)],
    [end, Math.min(85, north)],
  ];
}
