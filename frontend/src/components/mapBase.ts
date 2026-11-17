import * as maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import { Protocol, PMTiles, FetchSource } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
maplibregl.setWorkerUrl(workerUrl);
export type Region = {
  available: boolean;
  title: string;
  bounds: [number, number, number, number];
  center: [number, number];
  maxzoom: number;
  bytes: number;
  downloaded: string;
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
        maxzoom: region.maxzoom,
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

let users = 0;
let protocol: Protocol | null = null;
export function createLocalMap(
  container: HTMLDivElement,
  region: Region,
  center: [number, number],
  zoom: number,
  maxZoom = 18,
) {
  const url = window.location.origin + "/api/maps/region.pmtiles";
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
  const view = new maplibregl.Map({
    container,
    style: mapStyle(url, region),
    center,
    zoom,
    minZoom: 2,
    maxZoom,
    renderWorldCopies: false,
    transformRequest: (url) => ({
      url,
      headers: url.startsWith(window.location.origin + "/")
        ? { "X-Klinekraft-Client": "local-ui" }
        : {},
    }),
  });
  const resize = new ResizeObserver(() => view.resize());
  resize.observe(container);
  let removed = false;
  return {
    view,
    dispose() {
      if (removed) return;
      removed = true;
      resize.disconnect();
      view.remove();
      users--;
      if (!users) {
        maplibregl.removeProtocol("pmtiles");
        protocol = null;
      }
    },
  };
}
