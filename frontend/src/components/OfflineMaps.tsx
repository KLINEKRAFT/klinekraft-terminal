import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type * as GeoJSON from "geojson";
import { createLocalMap, type Region } from "./mapBase";
import { Search, MapPin, Route, Layers, X, LocateFixed } from "lucide-react";
import { MapCollections, type MapLocation } from "./MapCollections";
import { localJSON } from "./WikiReader";
import { isHostedDemo } from "../runtime";

type Place = { id: string; name: string; longitude: number; latitude: number };
export default function OfflineMaps({
  initialPlace,
  onConsumePlace,
}: {
  initialPlace?: MapLocation;
  onConsumePlace?: () => void;
}) {
  const [tool, setTool] = useState<
    "find" | "places" | "route" | "layers" | null
  >("find");
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTool(null);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  const [pinInfo, setPinInfo] = useState<MapLocation | null>(null);
  const [routeEnd, setRouteEnd] = useState<[number, number] | null>(null);
  const [startName, setStartName] = useState(""),
    [endName, setEndName] = useState("");
  const [gpsStatus, setGpsStatus] = useState("GPS setup pending");
  const [locating, setLocating] = useState(false);
  const [routeStart, setRouteStart] = useState<[number, number] | null>(null);
  const [routeProfile, setRouteProfile] = useState("car-fast");
  const [routing, setRouting] = useState(false);
  const [routeSummary, setRouteSummary] = useState("");
  const [routeData, setRouteData] = useState("");
  const [savedRoutes, setSavedRoutes] = useState<
    { id: string; created: string; profile: string }[]
  >([]);
  const [satellite, setSatellite] = useState(false);
  const [quakeVisible, setQuakeVisible] = useState(false);
  const [quakeStatus, setQuakeStatus] = useState("");
  async function toggleQuakes() {
    const view = map.current;
    if (!view || !ready) return;
    if (quakeVisible) {
      view.setLayoutProperty("earthquake-points", "visibility", "none");
      setQuakeVisible(false);
      return;
    }
    try {
      const data = await localJSON("/api/briefing/earthquakes");
      if (map.current !== view) return;
      if (view.getSource("earthquakes"))
        (view.getSource("earthquakes") as maplibregl.GeoJSONSource).setData(
          data.geojson,
        );
      else {
        view.addSource("earthquakes", {
          type: "geojson",
          data: data.geojson,
        });
        view.addLayer({
          id: "earthquake-points",
          type: "circle",
          source: "earthquakes",
          paint: {
            "circle-color": "#123aff",
            "circle-opacity": 0.65,
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 1,
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", "magnitude"],
              2.5,
              4,
              7,
              14,
            ],
          },
        });
        view.on("click", "earthquake-points", (e) => {
          const feature = e.features?.[0];
          if (feature)
            new maplibregl.Popup()
              .setLngLat(e.lngLat)
              .setText(String(feature.properties?.title))
              .addTo(view);
        });
      }
      view.setLayoutProperty("earthquake-points", "visibility", "visible");
      setQuakeVisible(true);
      setQuakeStatus(
        `USGS · ${data.stale ? "Last known" : "Updated"} · ${data.updated ? new Date(data.updated * 1000).toLocaleString() : "No saved data"}`,
      );
    } catch {
      setQuakeStatus("Earthquake feed unavailable");
    }
  }
  useEffect(() => {
    const request = new AbortController();
    localJSON("/api/routing/saved", { signal: request.signal })
      .then(setSavedRoutes)
      .catch(() => {});
    return () => request.abort();
  }, []);
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
    let disposeMap: (() => void) | undefined;
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
        let center: [number, number] = [-95.993, 36.154],
          zoom = 10;
        try {
          const saved = JSON.parse(
            localStorage.getItem("klinekraft.map-view.v1") || "null",
          );
          if (
            saved &&
            Array.isArray(saved.center) &&
            saved.center.length === 2 &&
            saved.center.every(
              (v: unknown) => typeof v === "number" && Number.isFinite(v),
            ) &&
            Math.abs(saved.center[0]) <= 180 &&
            Math.abs(saved.center[1]) <= 85 &&
            saved.zoom >= 2 &&
            saved.zoom <= 18
          ) {
            center = saved.center;
            zoom = saved.zoom;
          }
        } catch {}
        const local = createLocalMap(
          container.current!,
          metadata,
          center,
          zoom,
        );
        local.view.on("moveend", () => {
          try {
            localStorage.setItem(
              "klinekraft.map-view.v1",
              JSON.stringify({
                center: local.view.getCenter().toArray(),
                zoom: local.view.getZoom(),
              }),
            );
          } catch {}
        });
        disposeMap = local.dispose;
        const view = local.view;
        map.current = view;
        view.addControl(new maplibregl.NavigationControl(), "top-right");
        view.addControl(new maplibregl.ScaleControl({ unit: "imperial" }));
        view.addControl(
          new maplibregl.FullscreenControl({
            container: container.current!.closest(
              ".atlas-workspace",
            ) as HTMLElement,
          }),
        );
        view.on("load", () => {
          if (active) {
            setReady(true);
            setStatus("");
          }
        });
        view.on("error", (event) => {
          if (active)
            setStatus(
              "sourceId" in event && event.sourceId === "satellite"
                ? "Satellite imagery could not load. Switch to Street for offline maps."
                : "Some map data could not load. Check the installed region and refresh.",
            );
        });
        view.on("click", (event) => {
          const interactive = ["catalog-points", "earthquake-points"].filter(
            (id) => view.getLayer(id),
          );
          if (
            interactive.length &&
            view.queryRenderedFeatures(event.point, { layers: interactive })
              .length
          )
            return;
          setName("");
          setPinInfo(null);
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
      disposeMap?.();
      map.current = null;
    };
  }, []);
  const go = useCallback(
    (p: [number, number], label?: string, info?: MapLocation) => {
      if (!region || !map.current) return;
      const [west, south, east, north] = region.bounds;
      if (p[0] < west || p[0] > east || p[1] < south || p[1] > north) {
        setStatus("Those coordinates are outside the downloaded region.");
      } else setStatus("");
      setName(label?.slice(0, 120) || "");
      setPinInfo(info || null);
      setTool(null);
      setSelected(p);
      map.current.flyTo({ center: p, zoom: 14 });
      marker.current?.remove();
      marker.current = new maplibregl.Marker({ color: "#ff6a00" })
        .setLngLat(p)
        .addTo(map.current);
    },
    [region],
  );
  useEffect(() => {
    if (ready && initialPlace) {
      go(
        [initialPlace.longitude, initialPlace.latitude],
        initialPlace.name,
        initialPlace,
      );
      onConsumePlace?.();
    }
  }, [ready, initialPlace, go]);
  function toggleSatellite() {
    const view = map.current;
    if (!view || !ready) return;
    if (!view.getSource("satellite")) {
      view.addSource("satellite", {
        type: "raster",
        tiles: [
          "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        maxzoom: 16,
        attribution:
          '<a href="https://www.usgs.gov/the-national-map-data-delivery">USGS / USDA NAIP imagery</a>',
      });
      const firstOverlay = view
        .getStyle()
        .layers.find(
          (layer) =>
            layer.type === "symbol" ||
            layer.id === "catalog-points" ||
            layer.id === "earthquake-points" ||
            layer.id === "planned-route",
        );
      view.addLayer(
        { id: "satellite", type: "raster", source: "satellite" },
        firstOverlay?.id,
      );
    }
    view.setLayoutProperty(
      "satellite",
      "visibility",
      satellite ? "none" : "visible",
    );
    setSatellite(!satellite);
    setStatus("");
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
  function showRoute(data: GeoJSON.FeatureCollection<GeoJSON.LineString>) {
    const view = map.current;
    if (!view) return;
    if (view.getLayer("planned-route")) view.removeLayer("planned-route");
    if (view.getSource("planned-route")) view.removeSource("planned-route");
    view.addSource("planned-route", { type: "geojson", data });
    view.addLayer({
      id: "planned-route",
      type: "line",
      source: "planned-route",
      paint: { "line-color": "#003dff", "line-width": 5 },
    });
    const coordinates = data.features[0].geometry.coordinates as number[][];
    const bounds = new maplibregl.LngLatBounds();
    coordinates.forEach((p) => bounds.extend([p[0], p[1]]));
    view.fitBounds(bounds, { padding: 40 });
    const props = data.features[0].properties || {};
    setRouteSummary(
      `${(Number(props["track-length"]) / 1609.344).toFixed(1)} mi · saved on Pi; planned offline. Conditions and closures are unknown.`,
    );
    setRouteData(JSON.stringify(data));
  }
  async function restoreRoute(id: string) {
    if (!id) return;
    try {
      showRoute(
        await localJSON("/api/routing/saved/" + encodeURIComponent(id)),
      );
    } catch (e) {
      setRouteSummary((e as Error).message);
    }
  }
  async function calculateRoute() {
    if (!routeStart || !routeEnd || routing || !map.current) return;
    setRouting(true);
    setRouteSummary("");
    try {
      const data = await localJSON("/api/routing/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: { longitude: routeStart[0], latitude: routeStart[1] },
          end: { longitude: routeEnd[0], latitude: routeEnd[1] },
          profile: routeProfile,
        }),
      });
      showRoute(data);
      setSavedRoutes(await localJSON("/api/routing/saved"));
    } catch (e) {
      setRouteSummary((e as Error).message);
    } finally {
      setRouting(false);
    }
  }
  async function locate() {
    if (locating) return;
    setLocating(true);
    try {
      const fix = await localJSON("/api/maps/gps", {
        signal: AbortSignal.timeout(5000),
      });
      setGpsStatus(fix.message);
      if (fix.available) go([fix.longitude, fix.latitude], "GPS position");
    } catch {
      setGpsStatus("GPS unavailable");
    } finally {
      setLocating(false);
    }
  }
  const pinLabel =
    name.trim() ||
    (selected
      ? `${selected[1].toFixed(4)}, ${selected[0].toFixed(4)}`
      : "Selected point");
  function endpoint(which: "start" | "end") {
    if (!selected) return;
    if (which === "start") {
      setRouteStart(selected);
      setStartName(pinLabel);
    } else {
      setRouteEnd(selected);
      setEndName(pinLabel);
    }
    setRouteSummary("");
    setTool("route");
  }
  return (
    <section className="offline-maps atlas-workspace" aria-label="Offline maps">
      <div className="atlas-toolbar" aria-label="Map tools">
        {(
          [
            ["find", Search, "Find"],
            ["places", MapPin, "Places"],
            ["route", Route, "Route"],
            ["layers", Layers, "Layers"],
          ] as const
        ).map(([id, Icon, title]) => (
          <button
            key={id}
            aria-pressed={tool === id}
            aria-controls="atlas-panel"
            onClick={() => setTool(tool === id ? null : id)}
          >
            <Icon size={16} />
            {title}
          </button>
        ))}
        <div className="atlas-toolbar-spacer" />
        <button
          onClick={() => go([-95.993, 36.154], "Tulsa, Oklahoma")}
          disabled={!ready}
        >
          Tulsa
        </button>
        <button
          onClick={() => void locate()}
          disabled={!ready || locating}
          title={gpsStatus}
        >
          <LocateFixed size={16} />
          {locating ? "Checking…" : "GPS"}
        </button>
      </div>
      <div className="map-layout atlas-stage">
        <div
          ref={container}
          className="offline-map-canvas"
          aria-label="Interactive offline map"
        />
        <aside
          id="atlas-panel"
          className="map-sidebar atlas-panel"
          hidden={!tool}
          aria-label="Map tools panel"
        >
          <header>
            <strong>
              {tool === "find"
                ? "Find a place"
                : tool === "places"
                  ? "Places on this deck"
                  : tool === "route"
                    ? "Plan a route"
                    : "Map layers"}
            </strong>
            <button aria-label="Close map panel" onClick={() => setTool(null)}>
              <X size={17} />
            </button>
          </header>
          {tool === "places" && places.length > 0 && (
            <section className="atlas-saved">
              <span className="atlas-subtitle">Saved places</span>
              {places.map((p) => (
                <button
                  key={p.id}
                  onClick={() => go([p.longitude, p.latitude], p.name)}
                >
                  <MapPin size={14} />
                  {p.name}
                  <span>↗</span>
                </button>
              ))}
            </section>
          )}
          <MapCollections
            view={ready ? map.current : null}
            go={go}
            saved={places}
            mode={tool === "find" || tool === "places" ? tool : null}
          />
          <div hidden={tool !== "route"} className="atlas-route">
            <div className="route-endpoint">
              <span>A</span>
              <div>
                <small>Start</small>
                <strong>{startName || "Select a point on the map"}</strong>
              </div>
              <button
                aria-label="Set selected point as start"
                disabled={!selected}
                onClick={() => endpoint("start")}
              >
                Set
              </button>
            </div>
            <button
              className="route-swap"
              disabled={!routeStart || !routeEnd}
              onClick={() => {
                setRouteStart(routeEnd);
                setRouteEnd(routeStart);
                setStartName(endName);
                setEndName(startName);
                setRouteSummary("");
              }}
            >
              ⇅ Swap endpoints
            </button>
            <div className="route-endpoint">
              <span>B</span>
              <div>
                <small>Destination</small>
                <strong>{endName || "Select a point on the map"}</strong>
              </div>
              <button
                aria-label="Set selected point as destination"
                disabled={!selected}
                onClick={() => endpoint("end")}
              >
                Set
              </button>
            </div>
            <label>
              Travel mode
              <select
                value={routeProfile}
                onChange={(e) => setRouteProfile(e.target.value)}
                disabled={routing}
              >
                <option value="car-fast">Driving</option>
                <option value="trekking">Cycling</option>
                <option value="shortest">Walking</option>
              </select>
            </label>
            <button
              className="atlas-primary"
              disabled={!ready || !routeStart || !routeEnd || routing}
              onClick={() => void calculateRoute()}
            >
              {routing ? "Planning…" : "Plan offline route"}
            </button>
            {routeSummary && <p role="status">{routeSummary}</p>}
            {routeData && (
              <button
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([routeData], { type: "application/geo+json" }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "klinekraft-route.geojson";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                Export route
              </button>
            )}
            <details>
              <summary>Saved routes</summary>
              <select
                aria-label="Saved routes"
                defaultValue=""
                disabled={!ready || routing}
                onChange={(e) => void restoreRoute(e.target.value)}
              >
                <option value="">Choose a route</option>
                {savedRoutes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {new Date(r.created).toLocaleString()} · {r.profile}
                  </option>
                ))}
              </select>
            </details>
            <details className="atlas-info">
              <summary>Routing info</summary>
              <p>
                Select a place or tap the map, then assign it as Start or
                Destination. Routes calculate and save on the Pi. Road
                conditions and closures are unknown.
              </p>
            </details>
          </div>
          <div hidden={tool !== "layers"} className="atlas-layers">
            <span className="atlas-subtitle">Basemap</span>
            <div className="atlas-basemaps">
              <button
                disabled={!ready}
                aria-pressed={!satellite}
                onClick={() => satellite && toggleSatellite()}
              >
                Street<small>Offline</small>
              </button>
              <button
                disabled={!ready}
                aria-pressed={satellite}
                onClick={() => !satellite && toggleSatellite()}
              >
                Satellite<small>Online</small>
              </button>
            </div>
            <span className="atlas-subtitle">Overlay</span>
            <button
              disabled={!ready}
              aria-pressed={quakeVisible}
              onClick={() => void toggleQuakes()}
            >
              Earthquakes <span>{quakeVisible ? "On" : "Off"}</span>
            </button>
            {quakeStatus && <p>{quakeStatus}</p>}
            <span className="atlas-subtitle">Explore</span>
            {region?.views?.map((v) => (
              <button
                key={v.name}
                disabled={!ready}
                onClick={() =>
                  map.current?.flyTo({ center: v.center, zoom: v.zoom })
                }
              >
                {v.name}
              </button>
            ))}
            <details>
              <summary>Go to coordinates</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = coordinates.split(",").map(Number);
                  if (
                    v.length !== 2 ||
                    coordinates.split(",").some((s) => !s.trim()) ||
                    !v.every(Number.isFinite) ||
                    Math.abs(v[0]) > 85 ||
                    Math.abs(v[1]) > 180
                  ) {
                    setStatus(
                      "Enter latitude, longitude within −85…85 and −180…180.",
                    );
                    return;
                  }
                  go([v[1], v[0]]);
                }}
              >
                <input
                  aria-label="Go to coordinates"
                  placeholder="Latitude, longitude"
                  value={coordinates}
                  onChange={(e) => setCoordinates(e.target.value)}
                />
                <button disabled={!ready}>Go</button>
              </form>
            </details>
            <details className="atlas-info">
              <summary>Map & GPS info</summary>
              <p>
                {gpsStatus}. GPS reads a local gpsd receiver only; it does not
                change weather.
              </p>
              <p>
                Street maps: lower 48 + Alaska, no Hawaii.{" "}
                {region
                  ? `${(region.bytes / 1024 ** 3).toFixed(1)} GB saved`
                  : "Not installed"}
                .
              </p>
              <p>
                USGS imagery is historical, not live, and needs internet.
                Collections contain reference points, not access permissions.
              </p>
            </details>
          </div>
        </aside>
        <span className="atlas-mode">
          {satellite ? "SATELLITE · ONLINE" : "STREET · OFFLINE"}
        </span>
        {status && (
          <div className="atlas-status" role="status">
            <span>{status}</span>
            <button
              aria-label="Dismiss map status"
              onClick={() => setStatus("")}
            >
              <X size={14} />
            </button>
          </div>
        )}
        {gpsStatus !== "GPS setup pending" && (
          <span className="atlas-gps-status" role="status">
            {gpsStatus}
          </span>
        )}
      </div>
      {selected && (
        <div className="atlas-pinbar">
          <div>
            <strong>{pinLabel}</strong>
            {pinInfo?.url && (
              <a
                href={
                  pinInfo.url.startsWith("https://") ? pinInfo.url : undefined
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                Official site ↗
              </a>
            )}
          </div>
          <button onClick={() => endpoint("start")}>Start</button>
          <button onClick={() => endpoint("end")}>Destination</button>
          <details className="atlas-save">
            <summary>Save pin</summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <label>
                Place name
                <input
                  aria-label="Place name"
                  value={name}
                  maxLength={120}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <button disabled={!name.trim() || saving}>
                {saving ? "Saving…" : "Save place"}
              </button>
              {pinInfo?.note && <p>{pinInfo.note}</p>}
            </form>
          </details>
          <button
            aria-label="Clear selected pin"
            onClick={() => {
              setSelected(null);
              marker.current?.remove();
              setPinInfo(null);
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </section>
  );
}
