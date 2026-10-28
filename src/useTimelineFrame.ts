import { useEffect, useMemo, useState } from "react";
import type { FeatureCollection, LineString, MultiLineString } from "geojson";
import { airportFeatures } from "./geometry";
import { prepareTimelineRoute, timelineRouteFrame } from "./timeline";
import type { TimelineController } from "./useTimeline";

export function useTimelineFrame(tl: TimelineController) {
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  const prepared = useMemo(() => tl.open ? tl.stableFlights.filter(f => f.date).map(prepareTimelineRoute) : [], [tl.stableFlights, tl.open]);
  const range = useMemo(() => prepared.filter(r => r.flight.date! >= tl.start && r.flight.date! <= tl.end && tl.dates.length), [prepared, tl.start, tl.end, tl.dates]);
  const completedCount = Math.floor(tl.position);
  const completed = useMemo(() => range.filter(r => r.flight.date! <= (tl.dates[completedCount - 1] ?? "")), [range, tl.dates, completedCount]);
  const routes = useMemo<FeatureCollection<LineString | MultiLineString>>(() => ({ type: "FeatureCollection", features: completed.flatMap(r => r.geometry.features) }), [completed]);
  const completedAirports = useMemo(() => airportFeatures(completed.map(r => r.flight)), [completed]);
  const active = useMemo(() => range.filter(r => r.flight.date === tl.dates[completedCount]), [range, tl.dates, completedCount]);
  const fraction = reduced ? 0 : tl.position % 1;
  const frame = useMemo(() => {
    const frames = active.map(r => timelineRouteFrame(r, fraction));
    const ids = new Set(frames.flatMap(frame => [...frame.airportIds]));
    const airports = airportFeatures(active.map(r => r.flight)).features.filter(f => ids.has(f.properties!.id));
    const unique = new Map([...completedAirports.features, ...airports].map(f => [f.properties!.id, f]));
    return {
      activeRoutes: { type: "FeatureCollection" as const, features: frames.flatMap(f => f.routes.features) },
      airports: { type: "FeatureCollection" as const, features: [...unique.values()] },
      shownFlights: [...completed, ...(fraction > 0 ? active : [])].map(r => r.flight),
    };
  }, [active, fraction, completed, completedAirports]);
  const rangeFlights = useMemo(() => range.map(r => r.flight), [range]);
  return { routes, ...frame, rangeFlights };
}
