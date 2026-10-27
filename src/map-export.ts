import * as maplibregl from "maplibre-gl";
import type { Map as MapInstance } from "maplibre-gl";

/** Render a separate, high-resolution copy without moving the interactive map. */
export async function exportMapImage(
  source: MapInstance,
  flightCount: number,
  signal: AbortSignal,
): Promise<void> {
  const { width, height } = source.getCanvas().getBoundingClientRect();
  if (!width || !height) throw new Error("The map is not ready to export.");
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: `${width}px`,
    height: `${height}px`,
    pointerEvents: "none",
  });
  document.body.append(host);
  let copy: MapInstance | undefined;
  try {
    signal.throwIfAborted();
    copy = new maplibregl.Map({
      container: host,
      style: source.getStyle(),
      center: source.getCenter(),
      zoom: source.getZoom(),
      bearing: source.getBearing(),
      pitch: source.getPitch(),
      // Keep CSS dimensions/camera identical, including globe projection, and
      // increase only the rendering resolution. No bitmap upscaling.
      pixelRatio: 2400 / Math.max(width, height),
      canvasContextAttributes: { preserveDrawingBuffer: true },
      interactive: false,
      attributionControl: false,
      trackResize: false,
      fadeDuration: 0,
    });
    const renderer = copy;
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timeout);
        renderer.off("idle", ready);
        renderer.off("error", failed);
        signal.removeEventListener("abort", aborted);
        error ? reject(error) : resolve();
      };
      const ready = () => finish();
      const failed = () =>
        finish(
          new Error("Map data could not load for the image. Please try again."),
        );
      const aborted = () => finish(new Error("Map export cancelled."));
      const timeout = setTimeout(
        () =>
          finish(
            new Error("The map image took too long to load. Please try again."),
          ),
        25000,
      );
      renderer.on("idle", ready);
      renderer.on("error", failed);
      signal.addEventListener("abort", aborted, { once: true });
      if (signal.aborted) aborted();
    });
    signal.throwIfAborted();
    const rendered = copy.getCanvas();
    const image = document.createElement("canvas");
    image.width = rendered.width;
    image.height = rendered.height + 112;
    const context = image.getContext("2d");
    if (!context)
      throw new Error("This browser could not create the map image.");
    context.fillStyle = "#f7f8f5";
    context.fillRect(0, 0, image.width, image.height);
    context.drawImage(rendered, 0, 0);
    context.fillStyle = "#214f43";
    context.font = "28px sans-serif";
    context.fillText(
      `Tabibito · ${flightCount} ${flightCount === 1 ? "flight" : "flights"} in filtered history`,
      24,
      rendered.height + 40,
      image.width - 48,
    );
    context.fillStyle = "#526451";
    context.font = "20px sans-serif";
    context.fillText(
      "OpenFreeMap · © OpenMapTiles · © OpenStreetMap contributors",
      24,
      rendered.height + 72,
      image.width - 48,
    );
    context.font = "16px sans-serif";
    context.fillText(
      "openfreemap.org · openmaptiles.org · openstreetmap.org/copyright",
      24,
      rendered.height + 97,
      image.width - 48,
    );
    const blob = await new Promise<Blob>((resolve, reject) => {
      image.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error("This browser could not encode the map image.")),
        "image/png",
      );
    });
    signal.throwIfAborted();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tabibito-map-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } finally {
    copy?.remove();
    host.remove();
  }
}
