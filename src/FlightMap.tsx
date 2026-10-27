import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { type GeoJSONSource, type Map as MapInstance } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { airportFeatures, routeBounds, routeFeatures } from "./geometry";
import { airportCode, type Flight } from "./shared";
import { Icon } from "./icons";
import { exportMapImage } from "./map-export";

maplibregl.setWorkerUrl(workerUrl);

export default function FlightMap({
  flights,
  selected,
  onSelect,
}: {
  flights: Flight[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapInstance | null>(null);
  const latest = useRef({ flights, selected, onSelect });
  latest.current = { flights, selected, onSelect };
  const exportController = useRef<AbortController | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [globe, setGlobe] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const firstFit = useRef(false);
  useEffect(() => {
    setError("");
    setReady(false);
    firstFit.current = false;
    setGlobe(false);
    let instance: MapInstance;
    try {
      instance = new maplibregl.Map({
        container: container.current!,
        style: "https://tiles.openfreemap.org/styles/positron",
        center: [12, 25],
        zoom: 1.3,
        minZoom: 0.7,
        maxZoom: 12,
        attributionControl: { compact: true },
      });
      map.current = instance;
    } catch {
      setError(
        "The map could not start on this device. Your flight history is still available.",
      );
      return;
    }
    const timeout = setTimeout(() => {
      if (!instance.isStyleLoaded())
        setError(
          "The map is taking too long to load. Your flight history is still available.",
        );
    }, 15000);
    instance.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );
    instance.on("error", () =>
      setError(
        "Some map data could not load. You can still manage and back up your flights.",
      ),
    );
    instance.on("load", () => {
      clearTimeout(timeout);
      instance.addSource("routes", {
        type: "geojson",
        data: routeFeatures(latest.current.flights),
      });
      instance.addLayer({
        id: "routes",
        type: "line",
        source: "routes",
        paint: {
          "line-color": "#487c68",
          "line-width": 1.8,
          "line-opacity": 0.65,
        },
      });
      instance.addLayer({
        id: "route-targets",
        type: "line",
        source: "routes",
        paint: { "line-width": 14, "line-opacity": 0 },
      });
      instance.addLayer({
        id: "selected-route",
        type: "line",
        source: "routes",
        filter: ["==", ["get", "id"], ""],
        paint: { "line-color": "#bd632e", "line-width": 3, "line-opacity": 1 },
      });
      instance.addSource("airports", {
        type: "geojson",
        data: airportFeatures(latest.current.flights),
      });
      instance.addLayer({
        id: "airports",
        type: "circle",
        source: "airports",
        paint: {
          "circle-radius": 4.5,
          "circle-color": "#214f43",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      instance.addLayer({
        id: "airport-labels",
        type: "symbol",
        source: "airports",
        layout: {
          "text-field": ["get", "code"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
        },
        paint: {
          "text-color": "#244b42",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
        },
      });
      instance.on("click", "route-targets", (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === "string") latest.current.onSelect(id);
      });
      instance.on("mouseenter", "route-targets", () => {
        instance.getCanvas().style.cursor = "pointer";
      });
      instance.on("mouseleave", "route-targets", () => {
        instance.getCanvas().style.cursor = "";
      });
      setError("");
      setReady(true);
    });
    return () => {
      clearTimeout(timeout);
      exportController.current?.abort();
      instance.remove();
      map.current = null;
    };
  }, [attempt]);
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    (instance.getSource("routes") as GeoJSONSource).setData(
      routeFeatures(flights),
    );
    (instance.getSource("airports") as GeoJSONSource).setData(
      airportFeatures(flights),
    );
    instance.setFilter("selected-route", ["==", ["get", "id"], selected ?? ""]);
    const chosen = flights.find((flight) => flight.id === selected);
    if (chosen || (!firstFit.current && flights.length)) {
      const bounds = routeBounds(chosen ? [chosen] : flights);
      if (bounds)
        instance.fitBounds(bounds, {
          padding: 85,
          maxZoom: 5,
          duration: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? 0
            : 800,
        });
      firstFit.current = true;
    }
  }, [flights, selected, ready]);
  useEffect(() => {
    if (ready)
      map.current?.setProjection({ type: globe ? "globe" : "mercator" });
  }, [globe, ready]);
  async function downloadMap() {
    if (!map.current || exporting) return;
    const controller = new AbortController();
    exportController.current = controller;
    setExporting(true);
    setExportError("");
    try {
      await exportMapImage(map.current, flights.length, controller.signal);
    } catch (error) {
      if (!controller.signal.aborted)
        setExportError(
          error instanceof Error
            ? error.message
            : "The map image could not be exported. Please try again.",
        );
    } finally {
      if (exportController.current === controller) {
        exportController.current = null;
        setExporting(false);
      }
    }
  }
  const selectedFlight = flights.find((flight) => flight.id === selected);
  return (
    <section className="map-panel" aria-label="Flight route map">
      <div ref={container} className="map-canvas" />
      <div className="map-toolbar">
        <div className="map-caption">
          <span className="live-dot" />
          YOUR PERSONAL ATLAS
        </div>
        <div className="map-switch" aria-label="Map projection">
          <button
            aria-pressed={!globe}
            className={!globe ? "selected" : ""}
            onClick={() => setGlobe(false)}
            disabled={!ready}
          >
            <Icon name="map" size={16} />
            Map
          </button>
          <button
            aria-pressed={globe}
            className={globe ? "selected" : ""}
            onClick={() => setGlobe(true)}
            disabled={!ready}
          >
            <Icon name="globe" size={16} />
            Globe
          </button>
        </div>
      </div>
      {!ready && !error && (
        <div className="map-loading" role="status">
          <Icon name="globe" size={34} />
          <span>Opening your world…</span>
        </div>
      )}
      {error && (
        <div className="map-error" role="status">
          <span>{error}</span>
          <button onClick={() => setAttempt((count) => count + 1)}>
            Retry map
          </button>
        </div>
      )}
      {ready && !error && flights.length === 0 && (
        <div className="map-empty">
          <span className="compass-mark">✧</span>
          <h3>A world of possibilities</h3>
          <p>Your journeys will appear here.</p>
        </div>
      )}
      {exportError && (
        <div className="map-export-error" role="alert">
          {exportError}
          <button
            type="button"
            aria-label="Dismiss export error"
            onClick={() => setExportError("")}
          >
            ×
          </button>
        </div>
      )}
      <div className="map-bottom">
        <div className="map-legend">
          <span />
          {selectedFlight
            ? `${airportCode(selectedFlight.origin)} → ${airportCode(selectedFlight.destination)}`
            : `${flights.length} ${flights.length === 1 ? "flight" : "flights"} on the map`}
        </div>
        <div className="map-actions">
          <button
            type="button"
            className="fit-button"
            disabled={!ready || Boolean(error) || exporting}
            onClick={downloadMap}
            title="Download the current map view as a high-resolution PNG"
          >
            <Icon name="download" size={16} />
            {exporting ? "Exporting…" : "Export map"}
          </button>
          <button
            className="fit-button"
            disabled={!ready || !flights.length}
            onClick={() => {
              const bounds = routeBounds(flights);
              if (bounds)
                map.current?.fitBounds(bounds, {
                  padding: 85,
                  maxZoom: 5,
                  duration: 0,
                });
            }}
          >
            <Icon name="layers" size={16} />
            Show all
          </button>
        </div>
      </div>
    </section>
  );
}
