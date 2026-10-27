import { describe, expect, it } from "vitest";
import {
  createExpression,
  latest,
  type StylePropertySpecification,
} from "@maplibre/maplibre-gl-style-spec";
import type { StyleSpecification } from "maplibre-gl";
import { localizeMapStyle, mapControlLocale } from "../src/map-locale";

const style: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "city",
      type: "symbol",
      source: "tiles",
      layout: { "text-field": ["get", "name"] },
    },
    {
      id: "road",
      type: "symbol",
      source: "tiles",
      layout: { "text-field": ["get", "ref"] },
    },
    {
      id: "airport-labels",
      type: "symbol",
      source: "airports",
      layout: { "text-field": ["get", "code"] },
    },
  ],
};

describe("map localization", () => {
  it("renders available Chinese labels and falls back past missing and empty names", () => {
    const localized = localizeMapStyle(style, "zh-Hans");
    const layer = localized.layers[0];
    if (layer.type !== "symbol") throw new Error("Expected symbol");
    // The library runtime supports formatted labels; its public property union omits them.
    const expression = createExpression(
      layer.layout?.["text-field"],
      "text-field",
      latest.layout_symbol[
        "text-field"
      ] as unknown as StylePropertySpecification,
    );
    if (expression.result !== "success")
      throw new Error(JSON.stringify(expression.value));
    const render = (properties: Record<string, string>) =>
      expression.value
        .evaluate({ zoom: 3 }, { type: "Point", properties })
        .toString();
    expect(
      render({ "name:zh-Hans": "伦敦", "name:zh": "倫敦", name: "London" }),
    ).toBe("伦敦");
    expect(
      render({ "name:zh-Hans": "", "name:zh": "倫敦", name: "London" }),
    ).toBe("倫敦");
    expect(render({ "name:en": "London", name: "Londres" })).toBe("London");
    expect(render({ name: "Local name" })).toBe("Local name");
    expect(localized.layers[1]).toEqual(style.layers[1]);
    expect(localized.layers[2]).toEqual(style.layers[2]);
    expect(style.layers[0]).toMatchObject({
      layout: { "text-field": ["get", "name"] },
    });
  });
  it("provides translated accessible map controls", () => {
    expect(mapControlLocale("zh-Hans")["NavigationControl.ZoomIn"]).toBe(
      "放大",
    );
    expect(mapControlLocale("en")["NavigationControl.ZoomIn"]).toBe("Zoom in");
  });
});
