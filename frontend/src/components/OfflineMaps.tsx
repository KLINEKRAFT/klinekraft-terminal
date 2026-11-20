import { useGps, freshGps } from "../hooks/useGps";
import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type * as GeoJSON from "geojson";
import {
  createLocalMap,
  mapColor,
  satelliteSource,
  type Region,
} from "./mapBase";
import {
  Search,
  MapPin,
  Route,
  Layers,
  X,
  LocateFixed,
  Navigation,
  Copy,
  Check,
} from "lucide-react";
import { MapCollections, type MapLocation } from "./MapCollections";
import { localJSON } from "./WikiReader";
import { isHostedDemo } from "../runtime";

type Place = { id: string; name: string; longitude: number; latitude: number };
const TULSA: [number, number] = [-95.993, 36.154];
// Lower 48 framed on the built-in outline.
const US_VIEW = { center: [-97, 38.6] as [number, number], zoom: 3.3 };
const INSTALL_COMMAND =
  "python3 scripts/setup-maps.py --pmtiles /path/to/pmtiles --source https://build.protomaps.com/20261113.pmtiles";

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
  const gps = useGps();
  // The receiver can be unplugged and plugged back in at any time: an
  // unplugged unit is "disconnected", never "unsupported".
  const gpsDisconnected = !gps.current && gps.fix?.connected === false;
  const gpsStatus = gps.current
    ? `${gps.fix!.message}${gps.fix!.accuracyFeet != null ? ` · est. ${Math.round(gps.fix!.accuracyFeet)} ft` : ""}`
    : gpsDisconnected
      ? `GPS disconnected · reconnect the receiver to show your position${gps.age !== null ? ` · Last fix ${gps.age}s ago` : ""}`
      : `${gps.fix?.message || "Checking GPS…"}${gps.age !== null ? ` · Last fix ${gps.age}s ago` : ""}`;
  const gpsState = gps.current ? "ok" : gps.fix?.connected ? "warn" : undefined;
  const [followGps, setFollowGps] = useState(false);
  const gpsMarker = useRef<maplibregl.Marker | null>(null);
  const [spotName, setSpotName] = useState("");
  const [spotOpen, setSpotOpen] = useState(false);
  const [spotSaving, setSpotSaving] = useState(false);
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
  const [copied, setCopied] = useState(false);
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
            "circle-color": mapColor("--logo-blue", "#0227ff"),
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
    [status, setStatus] = useState("");
  // True while the built-in US outline stands in for the street map.
  const fallback = region !== null && !region.available;
  const [selected, setSelected] = useState<[number, number] | null>(null),
    [name, setName] = useState(""),
    [coordinates, setCoordinates] = useState(""),
    [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let disposeMap: (() => void) | undefined;
    // The map never waits on, or fails because of, saved places.
    localJSON("/api/maps/places", { signal: controller.signal })
      .then((saved: Place[]) => {
        if (active) setPlaces(saved);
      })
      .catch(() => {});
    void localJSON("/api/maps", { signal: controller.signal })
      .catch((error: Error): Region => {
        // No map service (or the hosted demo): still show the outline.
        if (active && !controller.signal.aborted && !isHostedDemo)
          setStatus(`Map service unavailable: ${error.message}`);
        return { available: false };
      })
      .then((metadata: Region) => {
        if (!active || !container.current) return;
        setRegion(metadata);
        let center: [number, number] = metadata.available
            ? TULSA
            : US_VIEW.center,
          zoom = metadata.available ? 10 : US_VIEW.zoom;
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
        const local = createLocalMap(container.current, metadata, center, zoom);
        disposeMap = local.dispose;
        const view = local.view;
        map.current = view;
        view.on("moveend", () => {
          try {
            localStorage.setItem(
              "klinekraft.map-view.v1",
              JSON.stringify({
                center: view.getCenter().toArray(),
                zoom: view.getZoom(),
              }),
            );
          } catch {}
        });
        view.on("dragstart", () => setFollowGps(false));
        view.addControl(new maplibregl.NavigationControl(), "top-right");
        view.addControl(new maplibregl.ScaleControl({ unit: "imperial" }));
        view.addControl(
          new maplibregl.FullscreenControl({
            container: container.current.closest(
              ".atlas-workspace",
            ) as HTMLElement,
          }),
        );
        view.on("load", () => {
          if (active) setReady(true);
        });
        view.on("error", (event) => {
          if (!active) return;
          console.error("Map error", event.error);
          setStatus(
            "sourceId" in event && event.sourceId === "satellite"
              ? "Satellite imagery could not load. It needs internet; switch back to the offline map."
              : local.fallback
                ? "The built-in outline could not load. Refresh the page."
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
          marker.current = new maplibregl.Marker({
            color: mapColor("--orange", "#ff6a00"),
          })
            .setLngLat(p)
            .addTo(view);
        });
      });
    return () => {
      active = false;
      controller.abort();
      marker.current?.remove();
      gpsMarker.current?.remove();
      gpsMarker.current = null;
      disposeMap?.();
      map.current = null;
    };
  }, []);
  const go = useCallback(
    (p: [number, number], label?: string, info?: MapLocation) => {
      if (!region || !map.current) return;
      if (region.available && region.bounds) {
        const [west, south, east, north] = region.bounds;
        if (p[0] < west || p[0] > east || p[1] < south || p[1] > north)
          setStatus("Those coordinates are outside the downloaded region.");
        else setStatus("");
      }
      setFollowGps(false);
      setName(label?.slice(0, 120) || "");
      setPinInfo(info || null);
      setTool(null);
      setSelected(p);
      // The outline has no street detail: a state-level view keeps context.
      map.current.jumpTo({
        center: p,
        zoom: region.available || satellite ? 14 : 5,
      });
      marker.current?.remove();
      marker.current = new maplibregl.Marker({
        color: mapColor("--orange", "#ff6a00"),
      })
        .setLngLat(p)
        .addTo(map.current);
    },
    [region, satellite],
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
      view.addSource("satellite", satelliteSource);
      // Imagery sits above the land but below borders, labels and overlays.
      const firstOverlay = view
        .getStyle()
        .layers.find(
          (layer) =>
            layer.type === "symbol" ||
            layer.id === "fallback-borders" ||
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
      paint: {
        "line-color": mapColor("--logo-blue", "#0227ff"),
        "line-width": 5,
      },
    });
    const coordinates = data.features[0].geometry.coordinates as number[][];
    const bounds = new maplibregl.LngLatBounds();
    coordinates.forEach((p) => bounds.extend([p[0], p[1]]));
    view.fitBounds(bounds, { padding: 40, duration: 0 });
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
  useEffect(() => {
    if (!ready || !map.current) return;
    if (!gps.current) {
      gpsMarker.current?.remove();
      gpsMarker.current = null;
      setFollowGps(false);
      return;
    }
    const fix = gps.fix!;
    const point: [number, number] = [fix.longitude!, fix.latitude!];
    if (!gpsMarker.current) {
      const dot = document.createElement("div");
      dot.className = "gps-position-dot";
      dot.setAttribute("aria-label", "Live GPS position");
      dot.title = "Live GPS position";
      gpsMarker.current = new maplibregl.Marker({ element: dot })
        .setLngLat(point)
        .addTo(map.current);
    } else gpsMarker.current.setLngLat(point);
    if (followGps) map.current.jumpTo({ center: point });
  }, [ready, gps.fix, gps.current, followGps]);
  function locate() {
    if (!freshGps(gps.fix)) return;
    go([gps.fix!.longitude!, gps.fix!.latitude!], "GPS position");
  }
  function gpsStart() {
    if (!freshGps(gps.fix)) return;
    setRouteStart([gps.fix!.longitude!, gps.fix!.latitude!]);
    setStartName("GPS position");
    setRouteSummary("");
    setTool("route");
  }
  async function saveSpot() {
    if (!freshGps(gps.fix) || !spotName.trim() || spotSaving) return;
    // Capture one fresh fix at the moment Save is pressed, not a moving target.
    const fix = gps.fix!;
    setSpotSaving(true);
    try {
      const place: Place = await localJSON("/api/maps/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          name: spotName.trim(),
          latitude: fix.latitude,
          longitude: fix.longitude,
        }),
      });
      setPlaces((all) => [place, ...all]);
      setSpotOpen(false);
      setSpotName("");
      setStatus("Spot saved on Pi.");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setSpotSaving(false);
    }
  }
  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setStatus("Copy is unavailable here; type the command shown.");
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
  const basemapName = fallback ? "Outline" : "Street";
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
            className="k-btn k-btn--quiet"
            aria-pressed={tool === id}
            aria-controls="atlas-panel"
            onClick={() => setTool(tool === id ? null : id)}
          >
            <Icon size={16} aria-hidden="true" />
            {title}
          </button>
        ))}
        <div className="atlas-toolbar-spacer" />
        <button
          className="k-btn"
          onClick={() => go(TULSA, "Tulsa, Oklahoma")}
          disabled={!ready}
        >
          Tulsa
        </button>
        <button
          className="k-btn"
          onClick={locate}
          disabled={!ready || !gps.current}
          title={gpsStatus}
        >
          <LocateFixed size={16} aria-hidden="true" />
          GPS
          <span
            className="k-status-dot"
            data-state={gpsState}
            aria-hidden="true"
          />
        </button>
        <button
          className="k-btn"
          disabled={!ready || !gps.current}
          aria-pressed={followGps}
          title={gps.current ? "Keep the map centered on GPS" : gpsStatus}
          onClick={() => {
            if (!freshGps(gps.fix)) return;
            if (!followGps) {
              locate();
              setFollowGps(true);
            } else setFollowGps(false);
          }}
        >
          <Navigation size={16} aria-hidden="true" />
          Follow
        </button>
        <button
          className="k-btn"
          disabled={!gps.current}
          aria-expanded={spotOpen}
          title={gps.current ? "Save your GPS position as a place" : gpsStatus}
          onClick={() => setSpotOpen(!spotOpen)}
        >
          Save this spot
        </button>
      </div>
      {spotOpen && (
        <form
          className="gps-save-spot"
          onSubmit={(e) => {
            e.preventDefault();
            void saveSpot();
          }}
        >
          <input
            className="k-field"
            aria-label="Spot name"
            placeholder="Car, campsite, trailhead…"
            value={spotName}
            maxLength={100}
            onChange={(e) => setSpotName(e.target.value)}
            autoFocus
          />
          <button
            className="k-btn k-btn--primary"
            disabled={!gps.current || !spotName.trim() || spotSaving}
          >
            {spotSaving ? "Saving…" : "Save spot"}
          </button>
          <button
            className="k-btn k-btn--quiet"
            type="button"
            onClick={() => setSpotOpen(false)}
          >
            Cancel
          </button>
          {!gps.current && (
            <span role="status">
              {gpsDisconnected
                ? "GPS disconnected · reconnect the receiver to save a spot."
                : "Waiting for a fresh GPS fix."}
            </span>
          )}
        </form>
      )}
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
            <button
              className="k-btn k-btn--quiet k-btn--icon"
              aria-label="Close map panel"
              onClick={() => setTool(null)}
            >
              <X size={18} />
            </button>
          </header>
          {tool === "places" && places.length > 0 && (
            <section className="atlas-saved">
              <span className="k-eyebrow">Saved places</span>
              <ul className="atlas-results">
                {places.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => go([p.longitude, p.latitude], p.name)}
                    >
                      <MapPin size={16} aria-hidden="true" />
                      <span>{p.name}</span>
                      <span aria-hidden="true">↗</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <MapCollections
            view={ready ? map.current : null}
            go={go}
            saved={places}
            mode={tool === "find" || tool === "places" ? tool : null}
          />
          <div hidden={tool !== "route"} className="atlas-route">
            <button
              className="k-btn"
              disabled={!gps.current || routing}
              title={gps.current ? undefined : gpsStatus}
              onClick={gpsStart}
            >
              <LocateFixed size={16} aria-hidden="true" />
              Use GPS as start
            </button>
            <div className="route-endpoint">
              <span aria-hidden="true">A</span>
              <div>
                <small>Start</small>
                <strong>{startName || "Select a point on the map"}</strong>
              </div>
              <button
                className="k-btn"
                aria-label="Set selected point as start"
                disabled={!selected}
                onClick={() => endpoint("start")}
              >
                Set
              </button>
            </div>
            <button
              className="k-btn k-btn--quiet route-swap"
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
              <span aria-hidden="true">B</span>
              <div>
                <small>Destination</small>
                <strong>{endName || "Select a point on the map"}</strong>
              </div>
              <button
                className="k-btn"
                aria-label="Set selected point as destination"
                disabled={!selected}
                onClick={() => endpoint("end")}
              >
                Set
              </button>
            </div>
            <label className="k-label">
              Travel mode
              <select
                className="k-select"
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
              className="k-btn k-btn--primary"
              disabled={!ready || !routeStart || !routeEnd || routing}
              onClick={() => void calculateRoute()}
            >
              {routing ? "Planning…" : "Plan offline route"}
            </button>
            {routeSummary && <p role="status">{routeSummary}</p>}
            {routeData && (
              <button
                className="k-btn"
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
            <label className="k-label">
              Saved routes
              <select
                className="k-select"
                aria-label="Saved routes"
                defaultValue=""
                disabled={!ready || routing || !savedRoutes.length}
                onChange={(e) => void restoreRoute(e.target.value)}
              >
                <option value="">
                  {savedRoutes.length ? "Choose a route" : "None saved yet"}
                </option>
                {savedRoutes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {new Date(r.created).toLocaleString()} · {r.profile}
                  </option>
                ))}
              </select>
            </label>
            <details className="atlas-info">
              <summary>Routing info</summary>
              <p>
                Select a place or tap the map, then assign it as Start or
                Destination. Routes calculate and save on the Pi with BRouter
                and work without street maps installed. Road conditions and
                closures are unknown.
              </p>
            </details>
          </div>
          <div hidden={tool !== "layers"} className="atlas-layers">
            <span className="k-eyebrow">Basemap</span>
            <div className="atlas-basemaps">
              <button
                className="k-btn"
                disabled={!ready}
                aria-pressed={!satellite}
                onClick={() => satellite && toggleSatellite()}
              >
                {basemapName}
                <small>Offline</small>
              </button>
              <button
                className="k-btn"
                disabled={!ready}
                aria-pressed={satellite}
                onClick={() => !satellite && toggleSatellite()}
              >
                Satellite<small>Online</small>
              </button>
            </div>
            <span className="k-eyebrow">Overlay</span>
            <button
              className="k-switch atlas-switch"
              role="switch"
              aria-checked={quakeVisible}
              disabled={!ready}
              onClick={() => void toggleQuakes()}
            >
              Earthquakes
            </button>
            {quakeStatus && <p className="atlas-note">{quakeStatus}</p>}
            {!!region?.views?.length && (
              <>
                <span className="k-eyebrow">Explore</span>
                {region.views.map((v) => (
                  <button
                    className="k-btn"
                    key={v.name}
                    disabled={!ready}
                    onClick={() =>
                      map.current?.jumpTo({ center: v.center, zoom: v.zoom })
                    }
                  >
                    {v.name}
                  </button>
                ))}
              </>
            )}
            <span className="k-eyebrow">Go to coordinates</span>
            <form
              className="atlas-coordinates"
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
                className="k-field"
                aria-label="Go to coordinates"
                placeholder="Latitude, longitude"
                value={coordinates}
                onChange={(e) => setCoordinates(e.target.value)}
              />
              <button className="k-btn" disabled={!ready}>
                Go
              </button>
            </form>
            <details className="atlas-info">
              <summary>Map & GPS info</summary>
              <p>
                {gpsStatus}. GPS reads a local gpsd receiver only; it does not
                change weather.
              </p>
              <p>
                Street maps: lower 48 + Alaska, no Hawaii.{" "}
                {region?.available && Number.isFinite(region.bytes)
                  ? `${(region.bytes! / 1024 ** 3).toFixed(1)} GB saved`
                  : "Not installed; the built-in US outline is shown instead"}
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
          {satellite
            ? "SATELLITE · ONLINE"
            : fallback
              ? "US OUTLINE · OFFLINE"
              : "STREET · OFFLINE"}
        </span>
        {gpsStatus && (
          <span className="atlas-gps-status" role="status" title={gpsStatus}>
            <span
              className="k-status-dot"
              data-state={gpsState}
              aria-hidden="true"
            />
            {gpsStatus}
          </span>
        )}
        <div className="atlas-notices">
          {status && (
            <div className="atlas-status" role="status">
              <span>{status}</span>
              <button
                className="k-btn k-btn--quiet k-btn--icon"
                aria-label="Dismiss map status"
                onClick={() => setStatus("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {fallback && !satellite && (
            <section
              className="k-card atlas-install"
              aria-label="Install street maps"
            >
              {isHostedDemo ? (
                <>
                  <h3>Built-in US outline</h3>
                  <p>
                    Street maps, GPS and saved places run on the deck. This web
                    demo shows the outline map only.
                  </p>
                </>
              ) : (
                <>
                  <header>
                    <h3>Install street maps</h3>
                    <button
                      className="k-btn k-btn--quiet k-btn--icon"
                      aria-label="Copy install command"
                      title="Copy install command"
                      onClick={() => void copyCommand()}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </header>
                  <p>
                    Built-in US outline only. For roads, towns and labels, run
                    this on the Pi (about 10 GB):
                  </p>
                  <code className="atlas-command">
                    {INSTALL_COMMAND.replaceAll(" --", " \\\n  --")}
                  </code>
                </>
              )}
            </section>
          )}
        </div>
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
          <button className="k-btn" onClick={() => endpoint("start")}>
            Start
          </button>
          <button className="k-btn" onClick={() => endpoint("end")}>
            Destination
          </button>
          <details className="atlas-save">
            <summary className="k-btn">Save pin</summary>
            <form
              className="k-card"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <label className="k-label">
                Place name
                <input
                  className="k-field"
                  aria-label="Place name"
                  value={name}
                  maxLength={120}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <button
                className="k-btn k-btn--primary"
                disabled={!name.trim() || saving}
              >
                {saving ? "Saving…" : "Save place"}
              </button>
              {pinInfo?.note && <p>{pinInfo.note}</p>}
            </form>
          </details>
          <button
            className="k-btn k-btn--quiet k-btn--icon"
            aria-label="Clear selected pin"
            onClick={() => {
              setSelected(null);
              marker.current?.remove();
              setPinInfo(null);
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </section>
  );
}
