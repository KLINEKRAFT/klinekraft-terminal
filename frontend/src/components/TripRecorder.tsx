import { useEffect, useState } from "react";
import { localJSON } from "./WikiReader";
import { Info } from "./Info";
import type { FeatureCollection } from "geojson";
type Trip = {
  id: string;
  started: string;
  state: string;
  miles: number;
  seconds: number;
  points: number;
};
type Point = { longitude: number; latitude: number; time: string };
export function TripRecorder({
  onTrail,
}: {
  onTrail: (data: FeatureCollection, fit?: boolean) => void;
}) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState<Trip | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = trips.find((t) => t.state === "recording");
  useEffect(() => {
    let disposed = false,
      polling = false;
    const controller = new AbortController();
    async function poll() {
      if (polling) return;
      polling = true;
      try {
        const list: Trip[] = await localJSON("/api/trips", {
          signal: controller.signal,
        });
        if (disposed) return;
        setTrips(list);
        const id =
          selected ||
          list.find((t) => t.state === "recording")?.id ||
          list[0]?.id;
        if (!id) {
          setDetail(null);
          onTrail({ type: "FeatureCollection", features: [] });
          return;
        }
        const data: Trip & { segments: Point[][] } = await localJSON(
          "/api/trips/" + id,
          { signal: controller.signal },
        );
        if (disposed) return;
        setDetail(data);
        onTrail({
          type: "FeatureCollection",
          features: data.segments
            .filter((s) => s.length > 1)
            .map((s) => ({
              type: "Feature" as const,
              properties: {},
              geometry: {
                type: "LineString" as const,
                coordinates: s.map((p) => [p.longitude, p.latitude]),
              },
            })),
        });
        setError("");
      } catch (e) {
        if (!disposed) setError((e as Error).message);
      } finally {
        polling = false;
      }
    }
    void poll();
    const timer = setInterval(() => void poll(), 5000);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [selected, onTrail, busy]);
  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const trip: Trip = await localJSON(
        active ? "/api/trips/" + active.id + "/stop" : "/api/trips/start",
        { method: "POST" },
      );
      setTrips((old) => [trip, ...old.filter((t) => t.id !== trip.id)]);
      setSelected(trip.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function viewTrip() {
    if (!detail) return;
    try {
      const data: { segments: Point[][] } = await localJSON(
        "/api/trips/" + detail.id,
      );
      onTrail(
        {
          type: "FeatureCollection",
          features: data.segments
            .filter((s) => s.length > 1)
            .map((s) => ({
              type: "Feature" as const,
              properties: {},
              geometry: {
                type: "LineString" as const,
                coordinates: s.map((p) => [p.longitude, p.latitude]),
              },
            })),
        },
        true,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function download() {
    if (!detail) return;
    try {
      const response = await fetch("/api/trips/" + detail.id + "/gpx", {
        headers: { "X-Klinekraft-Client": "local-ui" },
      });
      if (!response.ok) throw new Error("Could not export trip.");
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "klinekraft-trip-" + detail.id + ".gpx";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const duration = detail
    ? Math.floor(detail.seconds / 3600) +
      "h " +
      Math.floor((detail.seconds % 3600) / 60) +
      "m"
    : "";
  return (
    <div className="trip-recorder" aria-label="Trip recording">
      <button
        onClick={() => void toggle()}
        disabled={busy}
        aria-pressed={!!active}
      >
        {active ? "■ Stop recording" : "● Record trip"}
      </button>
      {active && <span className="trip-recording-indicator">Recording</span>}
      {trips.length > 0 && (
        <select
          aria-label="Saved trips"
          value={selected || active?.id || trips[0].id}
          onChange={(e) => setSelected(e.target.value)}
        >
          {trips.map((t) => (
            <option key={t.id} value={t.id}>
              {new Date(t.started).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}{" "}
              · {t.state}
            </option>
          ))}
        </select>
      )}
      {detail && (
        <>
          <span>
            {detail.miles.toFixed(2)} mi · {duration} · {detail.points} points
          </span>
          <button onClick={() => void viewTrip()} disabled={detail.points < 2}>
            View trail
          </button>
          <button onClick={() => void download()} disabled={!detail.points}>
            Export GPX
          </button>
        </>
      )}
      <Info label="Trip recording information">
        <p>
          Records on this Pi only after you press Record trip. Continues across
          pages and screen dimming. Stop recording before shutdown; interrupted
          trips are preserved and never resume automatically.
        </p>
        <p>
          GPS gaps over 30 seconds are separate segments. Distance is an
          estimate; poor fixes and small stationary movements are filtered. Trip
          data is included in the encrypted database backup.
        </p>
      </Info>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
