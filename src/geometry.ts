import { greatCircle } from "@turf/great-circle";
import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  Point,
} from "geojson";
import { airportCode, type Flight } from "./shared";

export function routeFeatures(
  flights: Flight[],
): FeatureCollection<LineString | MultiLineString> {
  return {
    type: "FeatureCollection",
    features: flights.map<Feature<LineString | MultiLineString>>((flight) => {
      const start: [number, number] = [
        flight.origin.longitude,
        flight.origin.latitude,
      ];
      const end: [number, number] = [
        flight.destination.longitude,
        flight.destination.latitude,
      ];
      // Turf's great-circle algorithm cannot select a unique path between antipodes.
      const antipodal =
        Math.abs(flight.origin.latitude + flight.destination.latitude) <
          0.00001 && Math.abs(Math.abs(start[0] - end[0]) - 180) < 0.00001;
      if (antipodal) {
        // Select an explicit intermediate point so both half-arcs remain deterministic.
        const midpoint: [number, number] = [
          ((start[0] + 90 + 540) % 360) - 180,
          0,
        ];
        const halves = [
          greatCircle(start, midpoint),
          greatCircle(midpoint, end),
        ];
        return {
          type: "Feature",
          properties: { id: flight.id },
          geometry: {
            type: "MultiLineString",
            coordinates: halves.flatMap((part) =>
              part.geometry.type === "LineString"
                ? [part.geometry.coordinates]
                : part.geometry.coordinates,
            ),
          },
        };
      }
      return greatCircle(start, end, {
        npoints: 128,
        properties: { id: flight.id },
      });
    }),
  };
}

export function airportFeatures(flights: Flight[]): FeatureCollection<Point> {
  const unique = new Map(
    flights
      .flatMap((flight) => [flight.origin, flight.destination])
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
