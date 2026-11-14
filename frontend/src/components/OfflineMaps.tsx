import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import { Protocol, PMTiles, FetchSource } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
maplibregl.setWorkerUrl(workerUrl);
import { localJSON } from "./WikiReader";
import { isHostedDemo } from "../runtime";

type Region = {
  available: boolean;
  title: string;
  bounds: [number, number, number, number];
  center: [number, number];
  maxzoom: number;
  bytes: number;
  downloaded: string;
  views?: { name: string; center: [number, number]; zoom: number }[];
};
type Place = { id: string; name: string; longitude: number; latitude: number };
const font = ["Noto Sans Regular"];
function style(url: string, region: Region): StyleSpecification {
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
export default function OfflineMaps() {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    marker = useRef<maplibregl.Marker | null>(null);
  const [region, setRegion] = useState<Region | null>(null),
    [places, setPlaces] = useState<Place[]>([]),
    [status, setStatus] = useState("Loading local map…");
  const [selected, setSelected] = useState<[number, number] | null>(null),
    [name, setName] = useState(""),
    [coordinates, setCoordinates] = useState(""),
    [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (isHostedDemo) {
      setStatus("Offline maps are available in the installed Pi app.");
      return;
    }
    const controller = new AbortController();
    let active = true;
    void Promise.all([
      localJSON("/api/maps", { signal: controller.signal }),
      localJSON("/api/maps/places", { signal: controller.signal }),
    ])
      .then(([metadata, saved]: [Region, Place[]]) => {
        if (!active) return;
        setRegion(metadata);
        setPlaces(saved);
        if (!metadata.available) {
          setStatus("No offline map region is installed.");
          return;
        }
        const url = window.location.origin + "/api/maps/region.pmtiles";
        const protocol = new Protocol();
        protocol.add(
          new PMTiles(
            new FetchSource(
              url,
              new Headers({ "X-Klinekraft-Client": "local-ui" }),
            ),
          ),
        );
        maplibregl.addProtocol("pmtiles", protocol.tile);
        const view = new maplibregl.Map({
          container: container.current!,
          style: style(url, metadata),
          center: metadata.center,
          zoom: metadata.views ? 3.5 : 11,
          minZoom: 2,
          maxZoom: 18,
          renderWorldCopies: false,
          transformRequest: (url) => ({
            url,
            headers: { "X-Klinekraft-Client": "local-ui" },
          }),
        });
        map.current = view;
        view.addControl(new maplibregl.NavigationControl(), "top-right");
        view.addControl(new maplibregl.ScaleControl());
        view.addControl(new maplibregl.FullscreenControl());
        view.on("load", () => {
          if (active) {
            setReady(true);
            setStatus("");
          }
        });
        view.on("error", () => {
          if (active)
            setStatus(
              "Some map data could not load. Check the installed region and refresh.",
            );
        });
        view.on("click", (event) => {
          const p: [number, number] = [event.lngLat.lng, event.lngLat.lat];
          setSelected(p);
          marker.current?.remove();
          marker.current = new maplibregl.Marker({ color: "#ff6a00" })
            .setLngLat(p)
            .addTo(view);
        });
      })
      .catch((error: Error) => {
        console.error("Offline map initialization failed", error);
        if (active) setStatus(error.message);
      });
    return () => {
      active = false;
      controller.abort();
      marker.current?.remove();
      map.current?.remove();
      map.current = null;
      maplibregl.removeProtocol("pmtiles");
    };
  }, []);
  function go(p: [number, number]) {
    if (!region || !map.current) return;
    const [west, south, east, north] = region.bounds;
    if (p[0] < west || p[0] > east || p[1] < south || p[1] > north) {
      setStatus("Those coordinates are outside the downloaded region.");
      return;
    }
    setSelected(p);
    map.current.flyTo({ center: p, zoom: 14 });
    marker.current?.remove();
    marker.current = new maplibregl.Marker({ color: "#ff6a00" })
      .setLngLat(p)
      .addTo(map.current);
  }
  async function save() {
    if (!selected || !name.trim() || saving) return;
    setSaving(true);
    try {
      const place = await localJSON("/api/maps/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          name: name.trim(),
          longitude: selected[0],
          latitude: selected[1],
        }),
      });
      setPlaces((items) => [place, ...items]);
      setName("");
      setStatus(
        "Place saved on the Pi, including in the Terminal database backup.",
      );
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="offline-maps" aria-label="Offline maps">
      <div className="map-heading">
        <div>
          <span className="eyebrow">OFFLINE ATLAS</span>
        </div>
        <span className="map-badge">GPS not connected</span>
      </div>
      {status && <p role="status">{status}</p>}
      <div className="map-layout">
        <div
          ref={container}
          className="offline-map-canvas"
          aria-label="Interactive offline map"
        />
        <aside className="map-sidebar">
          <h3>Explore</h3>
          {region?.views?.map((view) => (
            <button
              className="map-place"
              key={view.name}
              disabled={!ready}
              onClick={() =>
                map.current?.flyTo({ center: view.center, zoom: view.zoom })
              }
            >
              {view.name}
            </button>
          ))}
          <button
            disabled={!ready}
            onClick={() =>
              region &&
              (region.views
                ? map.current?.flyTo({ center: region.center, zoom: 3.5 })
                : map.current?.fitBounds(region.bounds, { padding: 20 }))
            }
          >
            {region?.views ? "Reset map view" : "Show downloaded region"}
          </button>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const values = coordinates.split(",").map(Number);
              if (
                values.length !== 2 ||
                coordinates.split(",").some((v) => !v.trim()) ||
                !values.every(Number.isFinite)
              ) {
                setStatus(
                  "Enter latitude, longitude — for example 36.1540, -95.9928.",
                );
                return;
              }
              go([values[1], values[0]]);
            }}
          >
            <label>
              Go to coordinates
              <input
                value={coordinates}
                onChange={(event) => setCoordinates(event.target.value)}
                placeholder="Latitude, longitude"
              />
            </label>
            <button disabled={!ready}>Go</button>
          </form>
          <h3>Save a place</h3>
          <p>
            {selected
              ? `${selected[1].toFixed(5)}, ${selected[0].toFixed(5)}`
              : "Click the map to drop a pin."}
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <label>
              Place name
              <input
                value={name}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <button disabled={!selected || !name.trim() || saving}>
              {saving ? "Saving…" : "Save place"}
            </button>
          </form>
          <h3>Saved places</h3>
          {places.length ? (
            places.map((place) => (
              <button
                className="map-place"
                key={place.id}
                onClick={() => go([place.longitude, place.latitude])}
              >
                {place.name}
              </button>
            ))
          ) : (
            <p>No saved places yet.</p>
          )}
        </aside>
      </div>
      <p className="organizer-caption">
        {region?.available
          ? `${(region.bytes / 1024 / 1024).toFixed(1)} MB of map tiles · Downloaded ${region.downloaded} · Street detail to zoom ${region.maxzoom}. `
          : ""}
        Map browsing and saved places work offline. Live GPS, address search and
        turn-by-turn routing are not connected.
      </p>
    </section>
  );
}
