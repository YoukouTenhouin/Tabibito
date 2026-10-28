import type { StyleSpecification } from "maplibre-gl";
import type { Theme } from "./theme";

// Both themes use the same cartography: changing the provider style also changes
// fonts, label ranks, collision rules, and the zoom levels at which places appear.
export const basemapStyleUrl = "https://tiles.openfreemap.org/styles/positron";

export function themeMapStyle(style: StyleSpecification, theme: Theme): StyleSpecification {
  if (theme === "light") return style;
  return {
    ...style,
    layers: style.layers.map(layer => {
      // Shields use sprite artwork and its default text color; keep those pairs.
      if (!layer.paint) return layer;
      const water = layer.id.startsWith("water");
      const color = (property: string): string => {
        if (property === "text-halo-color") return water ? "#111b21" : "#1b2621";
        if (property === "text-color") {
          if (water) return "#91aab9";
          return layer.id.startsWith("label_") ? "#bac8be" : "#a0b3aa";
        }
        if (property === "background-color") return "#1b2621";
        if (water) return "#111b21";
        if (layer.id.startsWith("boundary")) return "#526359";
        if (property === "fill-outline-color") return "#34473c";
        if (layer.type === "fill") {
          if (/park|wood/.test(layer.id)) return "#202d26";
          if (/building|residential/.test(layer.id)) return "#24322b";
          return "#2b3933";
        }
        return "#29372f";
      };
      const paint = Object.fromEntries(Object.entries(layer.paint).map(([property, value]) =>
        [property, property.endsWith("color") ? color(property) : value],
      ));
      // Some road labels rely on the style-spec's white halo default.
      if (layer.type === "symbol" && "text-color" in paint)
        paint["text-halo-color"] = color("text-halo-color");
      return { ...layer, paint };
    }),
  };
}
