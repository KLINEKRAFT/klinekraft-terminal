import { useEffect, useRef, useState } from "react";
import type { Map, GeoJSONSource, MapLayerMouseEvent } from "maplibre-gl";
import { Search, MapPin } from "lucide-react";
export type MapLocation = {
  id?: string;
  name: string;
  longitude: number;
  latitude: number;
  group?: string;
  url?: string;
  note?: string;
};
import { localJSON } from "./WikiReader";
import { mapColor } from "./mapBase";
type Catalog = {
  updated: string;
  groups: { id: string; name: string; note: string }[];
  places: MapLocation[];
};
const titles: Record<string, string> = {
  "national-parks": "National parks",
  "oklahoma-nps": "Oklahoma NPS",
  "oklahoma-land": "Oklahoma land",
  "missile-history": "Missile history",
};
export function MapCollections({
  view,
  go,
  mode,
  saved,
}: {
  view: Map | null;
  go: (p: [number, number], name?: string, info?: MapLocation) => void;
  mode: "find" | "places" | null;
  saved: MapLocation[];
}) {
  const addressRequest = useRef<AbortController | null>(null);
  useEffect(() => () => addressRequest.current?.abort(), []);
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [group, setGroup] = useState("national-parks"),
    [query, setQuery] = useState(""),
    [collectionQuery, setCollectionQuery] = useState("");
  const [results, setResults] = useState<MapLocation[]>([]),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [limit, setLimit] = useState(40);
  useEffect(() => {
    const controller = new AbortController();
    localJSON("/api/maps/catalog", { signal: controller.signal })
      .then(setCatalog)
      .catch(() => {
        if (!controller.signal.aborted)
          setStatus("Map collections unavailable");
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!view || !catalog) return;
    const data: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: catalog.places
        .filter((p) => p.group === group)
        .map((p) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
          properties: { ...p },
        })),
    };
    if (view.getSource("catalog"))
      (view.getSource("catalog") as GeoJSONSource).setData(data);
    else {
      view.addSource("catalog", { type: "geojson", data });
      view.addLayer({
        id: "catalog-points",
        type: "circle",
        source: "catalog",
        paint: {
          "circle-radius": 5,
          "circle-color": mapColor("--logo-blue", "#0227ff"),
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1.5,
        },
      });
    }
    const pick = (event: MapLayerMouseEvent) => {
      const p = event.features?.[0]?.properties as MapLocation | undefined;
      if (p) go([Number(p.longitude), Number(p.latitude)], p.name, p);
    };
    view.on("click", "catalog-points", pick);
    return () => {
      view.off("click", "catalog-points", pick);
    };
  }, [view, catalog, group, go]);
  async function search() {
    if (busy || query.trim().length < 3) return;
    addressRequest.current?.abort();
    const request = new AbortController();
    addressRequest.current = request;
    setBusy(true);
    setResults([]);
    setStatus("");
    try {
      const data = await localJSON("/api/maps/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: query.trim() }),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(20000)]),
      });
      if (request.signal.aborted) return;
      setResults(data.results);
      setStatus(
        data.results.length
          ? `${data.cached ? "Saved match" : "Address saved for offline use"} · approximate street location`
          : "No street-address match. Include city, state and ZIP.",
      );
    } catch (e) {
      if (!request.signal.aborted) setStatus((e as Error).message);
    } finally {
      if (addressRequest.current === request) setBusy(false);
    }
  }
  const locals = [
    {
      id: "tulsa",
      name: "Tulsa, Oklahoma",
      longitude: -95.993,
      latitude: 36.154,
      group: "City",
    },
    ...saved.map((p) => ({ ...p, group: "Saved" })),
    ...(catalog?.places || []),
  ]
    .filter(
      (p) =>
        query.trim() &&
        p.name.toLowerCase().includes(query.trim().toLowerCase()),
    )
    .slice(0, 30);
  const places = (catalog?.places || []).filter(
    (p) =>
      p.group === group &&
      p.name.toLowerCase().includes(collectionQuery.toLowerCase()),
  );
  const list = (rows: MapLocation[]) => (
    <ul className="atlas-results">
      {rows.map((p, i) => (
        <li key={p.id || p.name + i}>
          <button
            disabled={!view}
            onClick={() => go([p.longitude, p.latitude], p.name, p)}
          >
            <MapPin size={16} aria-hidden="true" />
            <span>
              {p.name}
              <small>
                {titles[p.group || ""] || p.group || "Address match"}
              </small>
            </span>
            <span aria-hidden="true">↗</span>
          </button>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="map-collections" hidden={!mode}>
      <div hidden={mode !== "find"}>
        <form
          className="atlas-search"
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
        >
          <label>
            <Search size={16} aria-hidden="true" />
            <input
              className="k-field"
              aria-label="US address"
              placeholder="Place name or street address"
              value={query}
              maxLength={100}
              onChange={(e) => {
                addressRequest.current?.abort();
                setBusy(false);
                setQuery(e.target.value);
                setResults([]);
                setStatus("");
              }}
            />
          </label>
          <button
            className="k-btn k-btn--primary"
            disabled={!view || busy || query.trim().length < 3}
          >
            {busy ? "Searching…" : "Find address"}
          </button>
        </form>
        {status && (
          <p className="atlas-note" role="status">
            {status}
          </p>
        )}
        {list(results)}
        {locals.length > 0 && (
          <>
            <span className="k-eyebrow">On this deck</span>
            {list(locals)}
          </>
        )}
        {!query && (
          <div className="k-empty atlas-empty">
            <Search size={24} aria-hidden="true" />
            <h3>Search offline places</h3>
            <p>Parks, saved places, or a US street address.</p>
          </div>
        )}
        {query && locals.length === 0 && !results.length && !busy && (
          <p className="atlas-note">
            No matching saved places. Use Find address for a street lookup.
          </p>
        )}
        <details className="atlas-info">
          <summary>Search info</summary>
          <p>
            Places search offline. New addresses use Census online; successful
            matches stay on this Pi. Address pins are approximate.
          </p>
        </details>
      </div>
      <div hidden={mode !== "places"}>
        <div className="atlas-collections" aria-label="Map collections">
          {catalog?.groups.map((g) => (
            <button
              key={g.id}
              className="k-btn"
              aria-pressed={group === g.id}
              onClick={() => {
                setGroup(group === g.id ? "" : g.id);
                setCollectionQuery("");
                setLimit(40);
              }}
            >
              {titles[g.id] || g.name}
              <small>
                {catalog.places.filter((p) => p.group === g.id).length}
              </small>
            </button>
          ))}
        </div>
        {group && (
          <>
            <input
              className="k-field"
              aria-label="Search map collection"
              placeholder="Filter collection…"
              value={collectionQuery}
              onChange={(e) => {
                setCollectionQuery(e.target.value);
                setLimit(40);
              }}
            />
            <div className="k-eyebrow">{places.length} locations · offline</div>
            {list(places.slice(0, limit))}
            {places.length > limit && (
              <button className="k-btn" onClick={() => setLimit((v) => v + 40)}>
                Show more locations
              </button>
            )}
            <details className="atlas-info">
              <summary>Collection info</summary>
              <p>{catalog?.groups.find((g) => g.id === group)?.note}</p>
              <p>
                Saved{" "}
                {catalog?.updated
                  ? new Date(catalog.updated).toLocaleDateString()
                  : "—"}
              </p>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
