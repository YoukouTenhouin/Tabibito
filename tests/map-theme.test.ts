import { expect, test } from "vitest";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import type { StyleSpecification } from "maplibre-gl";
import { readFileSync } from "node:fs";
import { themeMapStyle } from "../src/map-theme";
import { localizeMapStyle } from "../src/map-locale";

// Snapshot of https://tiles.openfreemap.org/styles/positron (2026-10-28).
// Retain the complete provider style so tests cover actual zoom expressions,
// label ranks, road shields, and defaults rather than invented label layouts.
const positron: StyleSpecification = JSON.parse(readFileSync(new URL("./fixtures/positron.json", import.meta.url), "utf8"));

for (const locale of ["en", "zh-Hans"] as const) {
  test(`${locale}: dark mode keeps light-mode typography, density, and hierarchy`, () => {
    const light = localizeMapStyle(themeMapStyle(positron, "light"), locale);
    const dark = localizeMapStyle(themeMapStyle(positron, "dark"), locale);
    expect(dark.layers.map(({ paint, ...layer }) => layer)).toEqual(light.layers.map(({ paint, ...layer }) => layer));
    expect(dark.sources).toEqual(light.sources);
    expect(dark.glyphs).toEqual(light.glyphs);
    expect(dark.sprite).toEqual(light.sprite);
    for (const [index, layer] of dark.layers.entries()) {
      const nonColors = (paint: unknown) => Object.fromEntries(Object.entries(paint ?? {}).filter(([key]) => !key.endsWith("color")));
      expect(nonColors(layer.paint)).toEqual(nonColors(light.layers[index].paint));
    }
    expect(dark.layers[0].paint).not.toEqual(light.layers[0].paint);
    expect(validateStyleMin(dark)).toEqual([]);
    expect(themeMapStyle(positron, "light")).toBe(positron);
    expect(positron.layers[0].paint).toEqual({ "background-color": "rgb(242,243,240)" });
  });
}
