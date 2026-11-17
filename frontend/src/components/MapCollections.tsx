import { useEffect, useState } from "react";
import type { Map, GeoJSONSource } from "maplibre-gl";
import { localJSON } from "./WikiReader";
import { SourceLink } from "./Briefing";

type Location = {
  id?: string;
  name: string;
  longitude: number;
  latitude: number;
  group?: string;
  url?: string;
  note?: string;
};
type Catalog = {
  updated: string;
  groups: { id: string; name: string; note: string }[];
  places: Location[];
};
export function MapCollections({
  view,
  go,
}: {
  view: Map | null;
  go: (p: [number, number], name?: string) => void;
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [group, setGroup] = useState("national-parks"),
    [query, setQuery] = useState("");
  const [address, setAddress] = useState(""),
    [results, setResults] = useState<Location[]>([]);
  const [selected, setSelected] = useState<Location | null>(null),
    [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
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
          "circle-color": "#123aff",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1.5,
        },
      });
    }
    const pick = (event: any) => {
      const p = event.features?.[0]?.properties as Location | undefined;
      if (p) {
        setSelected(p);
        go([Number(p.longitude), Number(p.latitude)], p.name);
      }
    };
    view.on("click", "catalog-points", pick);
    return () => {
      view.off("click", "catalog-points", pick);
    };
  }, [view, catalog, group, go]);
  async function search() {
    if (busy || address.trim().length < 3) return;
    setBusy(true);
    setResults([]);
    setStatus("");
    try {
      const data = await localJSON("/api/maps/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim() }),
        signal: AbortSignal.timeout(20000),
      });
      setResults(data.results);
      setStatus(
        data.results.length
          ? `${data.cached ? "Saved result" : "Census match saved"} · approximate street location`
          : "No address match. Include city, state and ZIP code.",
      );
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const filtered =
    catalog?.places.filter(
      (p) =>
        p.group === group && p.name.toLowerCase().includes(query.toLowerCase()),
    ) || [];
  return (
    <div className="map-collections">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <label>
          US address
          <input
            aria-label="US address"
            placeholder="Street, city, state, ZIP"
            value={address}
            maxLength={100}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>
        <button disabled={busy || !view || address.trim().length < 3}>
          {busy ? "Searching…" : "Find address"}
        </button>
      </form>
      {status && <p role="status">{status}</p>}
      {results.map((p) => (
        <button
          className="map-place"
          key={p.name}
          onClick={() => {
            setSelected(p);
            go([p.longitude, p.latitude], p.name);
          }}
        >
          {p.name}
        </button>
      ))}
      <details>
        <summary>Address search info</summary>
        <p>
          New searches use the US Census service online. Matched addresses are
          saved privately on this Pi for repeat searches offline. Pins are
          approximate, not surveyed building locations.
        </p>
      </details>
      <label>
        Map collection
        <select
          value={group}
          onChange={(e) => {
            setGroup(e.target.value);
            setSelected(null);
            setQuery("");
          }}
        >
          <option value="">Hide collection</option>
          {catalog?.groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      {group && (
        <>
          <input
            aria-label="Search map collection"
            placeholder="Search places…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <label>
            {filtered.length} locations
            <select
              aria-label="Choose map location"
              value=""
              disabled={!view}
              onChange={(e) => {
                const p = filtered.find((p) => p.id === e.target.value);
                if (p) {
                  setSelected(p);
                  go([p.longitude, p.latitude], p.name);
                }
              }}
            >
              <option value="">Choose a location</option>
              {filtered.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <details>
            <summary>Collection info</summary>
            <p>{catalog?.groups.find((g) => g.id === group)?.note}</p>
            <p>
              Saved{" "}
              {catalog?.updated
                ? new Date(catalog.updated).toLocaleDateString()
                : "—"}{" "}
              · available offline
            </p>
          </details>
        </>
      )}
      {selected && (
        <div className="map-location-detail">
          <strong>{selected.name}</strong>
          {selected.note && <p>{selected.note}</p>}
          {selected.url && (
            <SourceLink url={selected.url}>Official site ↗</SourceLink>
          )}
        </div>
      )}
    </div>
  );
}
