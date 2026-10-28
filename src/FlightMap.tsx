import { basemapStyleUrl, themeMapStyle } from "./map-theme";
import { useTheme } from "./theme";
import { errorCode, type ErrorCode } from "./errors";
import { localizeMapStyle, mapControlLocale } from "./map-locale";
import { useI18n } from "./i18n";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { type GeoJSONSource, type Map as MapInstance } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { airportFeatures, routeBounds, routeFeatures } from "./geometry";
import { routeAirports, airportCode, type Flight } from "./shared";
import { Icon } from "./icons";
import { exportMapImage } from "./map-export";
import { useTimeline } from "./useTimeline";
import { useTimelineFrame } from "./useTimelineFrame";
import { TimelineControls } from "./TimelineControls";

maplibregl.setWorkerUrl(workerUrl);

export default function FlightMap({
  flights,
  selected,
  onSelect,
  timelineScope,
}: {
  flights: Flight[];
  timelineScope: string;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  const { theme } = useTheme();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapInstance | null>(null);
  const latest = useRef({ flights, selected, onSelect });
  latest.current = { flights, selected, onSelect };
  const exportController = useRef<AbortController | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<ErrorCode | "">("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<ErrorCode | "">("");
  const [globe, setGlobe] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const timeline = useTimeline(flights, timelineScope, ready && !error);
  const timelineFrame = useTimelineFrame(timeline);
  const timelineOpen = useRef(timeline.open);
  timelineOpen.current = timeline.open;
  const shownFlights = timeline.open ? timelineFrame.shownFlights : flights;
  const firstFit = useRef(false);
  const camera = useRef<maplibregl.CameraOptions | null>(null);
  const skipFit = useRef(false);
  const latestGlobe = useRef(globe);
  latestGlobe.current = globe;
  useEffect(() => {
    setError("");
    setReady(false);
    skipFit.current = camera.current !== null;
    let instance: MapInstance;
    let initialized = false;
    try {
      instance = new maplibregl.Map({
        container: container.current!,
        style: basemapStyleUrl,
        center: [12, 25],
        zoom: 1.3,
        ...camera.current,
        locale: mapControlLocale(locale),
        localIdeographFontFamily:
          '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
        transformStyle: (_, style) =>
          localizeMapStyle(
            {
              ...themeMapStyle(style, theme),
              projection: { type: latestGlobe.current ? "globe" : "mercator" },
            },
            locale,
          ),
        minZoom: 0.7,
        maxZoom: 12,
        attributionControl: { compact: true },
      });
      map.current = instance;
    } catch {
      setError("errors.mapStart");
      return;
    }
    const timeout = setTimeout(() => {
      if (!instance.isStyleLoaded()) setError("errors.mapTimeout");
    }, 15000);
    instance.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );
    instance.on("error", () => setError("errors.mapData"));
    instance.on("load", () => {
      clearTimeout(timeout);
      instance.addSource("routes", {
        type: "geojson",
        data: routeFeatures(timelineOpen.current ? [] : latest.current.flights),
      });
      instance.addLayer({
        id: "routes",
        type: "line",
        source: "routes",
        paint: {
          "line-color": (theme === "dark" ? "#91c9a9" : "#487c68"),
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
        paint: { "line-color": (theme === "dark" ? "#e9a16d" : "#bd632e"), "line-width": 3, "line-opacity": 1 },
      });
      instance.addSource("active-routes", { type: "geojson", data: routeFeatures([]) });
      instance.addLayer({ id: "active-routes", type: "line", source: "active-routes",
        paint: { "line-color": (theme === "dark" ? "#91c9a9" : "#487c68"), "line-width": 1.8, "line-opacity": 0.65 } });
      instance.addLayer({ id: "active-targets", type: "line", source: "active-routes",
        paint: { "line-width": 14, "line-opacity": 0 } });
      instance.addLayer({ id: "active-selected", type: "line", source: "active-routes",
        filter: ["==", ["get", "id"], ""],
        paint: { "line-color": (theme === "dark" ? "#e9a16d" : "#bd632e"), "line-width": 3, "line-opacity": 1 } });
      instance.on("click", "active-targets", (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === "string") latest.current.onSelect(id);
      });
      instance.on("mouseenter", "active-targets", () => { instance.getCanvas().style.cursor = "pointer"; });
      instance.on("mouseleave", "active-targets", () => { instance.getCanvas().style.cursor = ""; });
      instance.addSource("airports", {
        type: "geojson",
        data: airportFeatures(timelineOpen.current ? [] : latest.current.flights),
      });
      instance.addLayer({
        id: "airports",
        type: "circle",
        source: "airports",
        paint: {
          "circle-radius": 4.5,
          "circle-color": (theme === "dark" ? "#91c9a9" : "#214f43"),
          "circle-stroke-color": (theme === "dark" ? "#1b2621" : "#ffffff"),
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
          "text-color": (theme === "dark" ? "#e5eee8" : "#244b42"),
          "text-halo-color": (theme === "dark" ? "#1b2621" : "#ffffff"),
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
      initialized = true;
      setError("");
      setReady(true);
    });
    const resizeObserver = new ResizeObserver(() => instance.resize());
    resizeObserver.observe(container.current!);
    return () => {
      resizeObserver.disconnect();
      clearTimeout(timeout);
      exportController.current?.abort();
      // A pan can leave tiles loading even after the map has initialized.
      if (initialized) {
        camera.current = {
          center: instance.getCenter(),
          zoom: instance.getZoom(),
          bearing: instance.getBearing(),
          pitch: instance.getPitch(),
        };
      }
      instance.remove();
      map.current = null;
    };
  }, [attempt, locale, theme]);
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance?.getSource("routes")) return;
    (instance.getSource("routes") as GeoJSONSource).setData(
      timeline.open ? timelineFrame.routes : routeFeatures(flights),
    );
  }, [flights, ready, timeline.open, timelineFrame.routes]);
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance?.getSource("active-routes")) return;
    (instance.getSource("active-routes") as GeoJSONSource).setData(timeline.open ? timelineFrame.activeRoutes : routeFeatures([]));
    (instance.getSource("airports") as GeoJSONSource).setData(timeline.open ? timelineFrame.airports : airportFeatures(flights));
  }, [flights, ready, timeline.open, timelineFrame.activeRoutes, timelineFrame.airports]);
  useEffect(() => {
    if (!ready || !map.current?.getLayer("selected-route")) return;
    for (const layer of ["selected-route", "active-selected"])
      map.current.setFilter(layer, ["==", ["get", "id"], selected ?? ""]);
  }, [selected, ready]);
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || timeline.open) return;
    if (skipFit.current) { skipFit.current = false; return; }
    const chosen = flights.find((flight) => flight.id === selected);
    if (chosen || (!firstFit.current && flights.length)) {
      const bounds = routeBounds(chosen ? [chosen] : flights);
      if (bounds) instance.fitBounds(bounds, {
        padding: 85, maxZoom: 5,
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 800,
      });
      firstFit.current = true;
    }
  }, [flights, selected, ready, timeline.open]);
  useEffect(() => {
    if (ready && map.current?.isStyleLoaded())
      map.current.setProjection({ type: globe ? "globe" : "mercator" });
  }, [globe, ready]);
  async function downloadMap() {
    if (!map.current || exporting || timeline.playing) return;
    const controller = new AbortController();
    exportController.current = controller;
    setExporting(true);
    setExportError("");
    try {
      await exportMapImage(
        map.current,
        shownFlights.length,
        controller.signal,
        locale,
        theme,
      );
    } catch (error) {
      if (!controller.signal.aborted)
        setExportError(
          errorCode(error) === "errors.generic"
            ? "errors.export"
            : errorCode(error),
        );
    } finally {
      if (exportController.current === controller) {
        exportController.current = null;
        setExporting(false);
      }
    }
  }
  function playTimeline() {
    if (!timeline.playing && (timeline.position === 0 || timeline.position >= timeline.dates.length)) {
      const bounds = routeBounds(timelineFrame.rangeFlights);
      if (bounds) map.current?.fitBounds(bounds, { padding: 85, maxZoom: 5, duration: 0 });
    }
    timeline.play();
  }
  const selectedFlight = shownFlights.find((flight) => flight.id === selected);
  return (
    <div className="map-with-timeline">
      <section className="map-panel" aria-label={t("map.label")}>
        <div ref={container} className="map-canvas" />
        <div className="map-toolbar">
          <div className="map-switch" aria-label={t("map.projection")}>
            <button type="button" aria-pressed={timeline.open} className={timeline.open ? "selected" : ""} disabled={exporting} onClick={timeline.toggle}>{t("timeline.title")}</button>
            <button
              aria-pressed={!globe}
              className={!globe ? "selected" : ""}
              onClick={() => setGlobe(false)}
              disabled={!ready}
            >
              <Icon name="map" size={16} />
              {t("map.flat")}
            </button>
            <button
              aria-pressed={globe}
              className={globe ? "selected" : ""}
              onClick={() => setGlobe(true)}
              disabled={!ready}
            >
              <Icon name="globe" size={16} />
              {t("map.globe")}
            </button>
          </div>
        </div>
        {!ready && !error && (
          <div className="map-loading" role="status">
            <Icon name="globe" size={34} />
            <span>{t("map.opening")}</span>
          </div>
        )}
        {error && (
          <div className="map-error" role="status">
            <span>{t(error)}</span>
            <button onClick={() => setAttempt((count) => count + 1)}>
              {t("map.retry")}
            </button>
          </div>
        )}
        {exportError && (
          <div className="map-export-error" role="alert">
            {t(exportError)}
            <button
              type="button"
              aria-label={t("map.dismissError")}
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
              ? routeAirports(selectedFlight).map(airportCode).join(" → ")
              : t("map.count", { count: shownFlights.length })}
          </div>
          <div className="map-actions">
            <button
              type="button"
              className="fit-button"
              disabled={!ready || Boolean(error) || exporting || timeline.playing}
              onClick={downloadMap}
              title={t("map.exportTitle")}
            >
              <Icon name="download" size={16} />
              {exporting ? t("map.exporting") : t("map.export")}
            </button>
            <button
              className="fit-button"
              disabled={!ready || !(timeline.open ? timelineFrame.rangeFlights : flights).length}
              onClick={() => {
                const bounds = routeBounds(timeline.open ? timelineFrame.rangeFlights : flights);
                if (bounds)
                  map.current?.fitBounds(bounds, {
                    padding: 85,
                    maxZoom: 5,
                    duration: 0,
                  });
              }}
            >
              <Icon name="layers" size={16} />
              {t("map.showAll")}
            </button>
          </div>
        </div>
        {timeline.open && (
          <TimelineControls
            timeline={{ ...timeline, play: playTimeline }}
            disabled={exporting}
            available={ready && !error}
          />
        )}
      </section>
    </div>
  );
}
