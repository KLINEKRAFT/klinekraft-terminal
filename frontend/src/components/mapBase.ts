import * as maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import { Protocol, PMTiles, FetchSource } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
maplibregl.setWorkerUrl(workerUrl);
// The deck shares RAM and power with the display, GPS and offline model.
maplibregl.setWorkerCount(1);
export type Region = {
  available: boolean;
  title?: string;
  bounds?: [number, number, number, number];
  center?: [number, number];
  maxzoom?: number;
  bytes?: number;
  downloaded?: string;
  views?: { name: string; center: [number, number]; zoom: number }[];
};
const font = ["Noto Sans Regular"];
export function mapStyle(url: string, region: Region): StyleSpecification {
  return {
    version: 8,
    glyphs: window.location.origin + "/api/maps/fonts/{fontstack}/{range}.pbf",
    sources: {
      local: {
        type: "vector",
        tiles: ["pmtiles://" + url + "/{z}/{x}/{y}"],
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · <a href="https://protomaps.com">Protomaps</a>',
        minzoom: 0,
        maxzoom: region.maxzoom ?? 14,
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#eeeae0" },
      },
      {
        id: "earth",
        type: "fill",
        source: "local",
        "source-layer": "earth",
        paint: { "fill-color": "#f2f0ea" },
      },
      {
        id: "nature",
        type: "fill",
        source: "local",
        "source-layer": "landcover",
        paint: { "fill-color": "#d6dfce", "fill-opacity": 0.55 },
      },
      {
        id: "parks",
        type: "fill",
        source: "local",
        "source-layer": "landuse",
        paint: { "fill-color": "#cddac5", "fill-opacity": 0.55 },
      },
      {
        id: "water",
        type: "fill",
        source: "local",
        "source-layer": "water",
        paint: { "fill-color": "#acc5eb" },
      },
      {
        id: "buildings",
        type: "fill",
        source: "local",
        "source-layer": "buildings",
        minzoom: 13,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": "#c7bfb1", "fill-outline-color": "#b3a998" },
      },
      {
        id: "roads-case",
        type: "line",
        source: "local",
        "source-layer": "roads",
        paint: {
          "line-color": "#ffffff",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8,
            1,
            14,
            5,
            17,
            10,
          ],
        },
      },
      {
        id: "roads",
        type: "line",
        source: "local",
        "source-layer": "roads",
        paint: {
          "line-color": [
            "match",
            ["get", "kind"],
            "highway",
            "#0227ff",
            "major_road",
            "#5578cf",
            "#9198a8",
          ],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8,
            0.5,
            14,
            2,
            17,
            5,
          ],
        },
      },
      {
        id: "road-labels",
        type: "symbol",
        source: "local",
        "source-layer": "roads",
        minzoom: 12,
        layout: {
          "symbol-placement": "line",
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"], ""],
          "text-font": font,
          "text-size": 11,
        },
        paint: {
          "text-color": "#303b50",
          "text-halo-color": "#f2f0ea",
          "text-halo-width": 2,
        },
      },
      {
        id: "places",
        type: "symbol",
        source: "local",
        "source-layer": "places",
        layout: {
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"], ""],
          "text-font": font,
          "text-size": 14,
        },
        paint: {
          "text-color": "#242424",
          "text-halo-color": "#f2f0ea",
          "text-halo-width": 2,
        },
      },
      {
        id: "pois",
        type: "symbol",
        source: "local",
        "source-layer": "pois",
        minzoom: 14,
        layout: {
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"], ""],
          "text-font": font,
          "text-size": 11,
        },
        paint: {
          "text-color": "#6c5137",
          "text-halo-color": "#f2f0ea",
          "text-halo-width": 2,
        },
      },
    ],
  };
}

/** Public USGS imagery. Historical, online-only; works over either basemap. */
export const satelliteSource: maplibregl.RasterSourceSpecification = {
  type: "raster",
  tiles: [
    "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}",
  ],
  tileSize: 256,
  maxzoom: 16,
  attribution:
    '<a href="https://www.usgs.gov/the-national-map-data-delivery">USGS / USDA NAIP imagery</a>',
};

/* ── Built-in fallback basemap ──────────────────────────────────────────
   A ~250 KB US state outline bundled with the UI (frontend/public/maps).
   It needs no installed region, no glyphs and no network, so the map is
   never blank. Colors come from the ui.css tokens and follow light/dark. */
export const FALLBACK_OUTLINE_URL = "/maps/us-states.geojson";

function token(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}
/** A ui.css color token as a hex string MapLibre can paint with. */
export const mapColor = token;
function mix(a: string, b: string, amount: number) {
  const channel = (hex: string, i: number) =>
    parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return (
    "#" +
    [0, 1, 2]
      .map((i) =>
        Math.round(channel(a, i) * (1 - amount) + channel(b, i) * amount)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
/** Fallback map colors derived from the current theme's tokens. */
export function fallbackColors() {
  const dark = document.documentElement.dataset.theme === "dark";
  const paper = token("--paper", dark ? "#15191e" : "#f2f0ea");
  const panel = token("--panel", dark ? "#252c34" : "#e4e1da");
  const line = token("--line", dark ? "#3b4550" : "#d2cfc6");
  const muted = token("--muted", dark ? "#b0b7c0" : "#69675f");
  const blue = token(dark ? "--blue" : "--logo-blue", "#0227ff");
  return dark
    ? {
        water: mix(paper, blue, 0.05),
        land: panel,
        border: mix(line, muted, 0.35),
      }
    : {
        water: mix(panel, blue, 0.08),
        land: paper,
        border: mix(line, muted, 0.45),
      };
}
export function fallbackStyle(): StyleSpecification {
  const colors = fallbackColors();
  return {
    version: 8,
    sources: {
      outline: {
        type: "geojson",
        data: window.location.origin + FALLBACK_OUTLINE_URL,
        attribution: "US outline: U.S. Census Bureau",
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": colors.water },
      },
      {
        id: "fallback-land",
        type: "fill",
        source: "outline",
        paint: { "fill-color": colors.land },
      },
      {
        id: "fallback-borders",
        type: "line",
        source: "outline",
        paint: {
          "line-color": colors.border,
          "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 8, 1.4],
        },
      },
    ],
  };
}
function paintFallback(view: maplibregl.Map) {
  if (!view.getLayer("fallback-land")) return;
  const colors = fallbackColors();
  view.setPaintProperty("background", "background-color", colors.water);
  view.setPaintProperty("fallback-land", "fill-color", colors.land);
  view.setPaintProperty("fallback-borders", "line-color", colors.border);
}

let users = 0;
let protocol: Protocol | null = null;
/**
 * Creates the deck's map: the installed street region when there is one,
 * otherwise the built-in outline. `fallback` tells the caller which.
 */
export function createLocalMap(
  container: HTMLDivElement,
  region: Region,
  center: [number, number],
  zoom: number,
  maxZoom = 18,
) {
  const fallback = !region.available;
  const url = window.location.origin + "/api/maps/region.pmtiles";
  if (!fallback) {
    if (!protocol) {
      protocol = new Protocol();
      protocol.add(
        new PMTiles(
          new FetchSource(
            url,
            new Headers({ "X-Klinekraft-Client": "local-ui" }),
          ),
        ),
      );
      maplibregl.addProtocol("pmtiles", protocol.tile);
    }
    users++;
  }
  const view = new maplibregl.Map({
    container,
    style: fallback ? fallbackStyle() : mapStyle(url, region),
    center,
    zoom,
    minZoom: 2,
    maxZoom,
    renderWorldCopies: false,
    // Bound GPU surfaces and retained tiles on the small Pi display.
    pixelRatio: Math.min(window.devicePixelRatio || 1, 1),
    canvasContextAttributes: { antialias: false, powerPreference: "low-power" },
    maxTileCacheSize: 64,
    maxTileCacheZoomLevels: 2,
    fadeDuration: 0,
    transformRequest: (url) => ({
      url,
      headers: url.startsWith(window.location.origin + "/")
        ? { "X-Klinekraft-Client": "local-ui" }
        : {},
    }),
  });
  let removed = false;
  let frame = 0;
  let width = container.clientWidth;
  let height = container.clientHeight;
  const resize = new ResizeObserver(() => {
    const nextWidth = container.clientWidth;
    const nextHeight = container.clientHeight;
    if (removed || (nextWidth === width && nextHeight === height)) return;
    width = nextWidth;
    height = nextHeight;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!removed) view.resize();
    });
  });
  resize.observe(container);
  // The outline follows the light/dark toggle without rebuilding the map.
  const theme = new MutationObserver(() => {
    if (!removed && view.isStyleLoaded()) paintFallback(view);
  });
  if (fallback)
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
  return {
    view,
    fallback,
    dispose() {
      if (removed) return;
      removed = true;
      resize.disconnect();
      theme.disconnect();
      cancelAnimationFrame(frame);
      view.remove();
      if (!fallback) {
        users--;
        if (!users) {
          maplibregl.removeProtocol("pmtiles");
          protocol = null;
        }
      }
    },
  };
}
