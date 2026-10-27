import type { StyleSpecification, ExpressionSpecification } from "maplibre-gl";
import { i18n, type Locale } from "./i18n";

function usesPlaceName(value: unknown): boolean {
  if (typeof value === "string")
    return /\{name(?::[^}]+|_[^}]+)?\}/.test(value);
  if (!Array.isArray(value)) return false;
  return (
    (value[0] === "get" &&
      typeof value[1] === "string" &&
      /^name(?::|_|$)/.test(value[1])) ||
    value.some(usesPlaceName)
  );
}

/** Only change name labels, preserving route codes, highway shields and style details. */
export function localizeMapStyle(
  style: StyleSpecification,
  locale: Locale,
): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map((layer) => {
      if (
        layer.type !== "symbol" ||
        !layer.layout?.["text-field"] ||
        !usesPlaceName(layer.layout["text-field"])
      )
        return layer;
      const original = layer.layout["text-field"];
      if (typeof original !== "string" && !Array.isArray(original))
        return layer;
      const keys =
        locale === "zh-Hans"
          ? ["name:zh-Hans", "name:zh", "name:en", "name_en"]
          : ["name:en", "name_en"];
      const text = keys.reduceRight<ExpressionSpecification | string>(
        (fallback, key) => [
          "case",
          ["all", ["has", key], ["!=", ["get", key], ""]],
          ["get", key],
          fallback,
        ],
        original,
      );
      return {
        ...layer,
        layout: {
          ...layer.layout,
          "text-field": text,
        },
      };
    }),
  };
}

export function mapControlLocale(locale: Locale) {
  const t = i18n.getFixedT(locale);
  return {
    "Map.Title": t("map.label"),
    "NavigationControl.ZoomIn": t("map.zoomIn"),
    "NavigationControl.ZoomOut": t("map.zoomOut"),
    "AttributionControl.ToggleAttribution": t("map.attribution"),
    "AttributionControl.MapFeedback": t("map.feedback"),
  };
}
