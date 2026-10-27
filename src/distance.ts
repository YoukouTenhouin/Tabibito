import type { Flight } from "./shared";

type Route = Pick<Flight, "origin" | "destination">;
const EARTH_RADIUS_KM = 6371.0088;
const KM_PER_MILE = 1.609344;

/** Haversine distance on a sphere; independent of map projection or route drawing. */
export function flightDistanceKm({ origin, destination }: Route): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitude = radians(destination.latitude - origin.latitude);
  const longitude = radians(destination.longitude - origin.longitude);
  const haversine =
    Math.sin(latitude / 2) ** 2 +
    Math.cos(radians(origin.latitude)) *
      Math.cos(radians(destination.latitude)) *
      Math.sin(longitude / 2) ** 2;
  // Clamp floating point drift at identical and antipodal coordinates.
  return (
    2 *
    EARTH_RADIUS_KM *
    Math.asin(Math.sqrt(Math.min(1, Math.max(0, haversine))))
  );
}

export function totalFlightDistance(flights: readonly Route[]) {
  const km = flights.reduce((sum, flight) => sum + flightDistanceKm(flight), 0);
  return { km, miles: km / KM_PER_MILE };
}

export const formatDistance = (value: number, locale: string = "en") =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
