// Radar interaction adapted from KLINEKRAFT/WEATHER (63ed98c), using this deck's offline basemap.
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { Pause, Play, LocateFixed, RefreshCw, Plus, Minus } from "lucide-react";
import { createLocalMap } from "./mapBase";
import { localJSON } from "./WikiReader";
type Frame = { time: number; path: string };
type Manifest = { host: string; frames: Frame[] };
export default function WeatherRadar({
  latitude,
  longitude,
  location,
  zone = "America/Chicago",
}: {
  latitude: number;
  longitude: number;
  location: string;
  zone?: string;
}) {
  const canvas = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    shown = useRef<string | null>(null);
  const [ready, setReady] = useState(false),
    [manifest, setManifest] = useState<Manifest | null>(null),
    [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false),
    [loading, setLoading] = useState(false),
    [displayTime, setDisplayTime] = useState<number | null>(null);
  const [feedError, setError] = useState(""),
    [mapError, setMapError] = useState(""),
    [tileError, setTileError] = useState(""),
    [refresh, setRefresh] = useState(0);
  // The missing-basemap error is permanent; a later radar fetch must not clear it.
  const error = mapError || feedError;
  const initial = useRef({ latitude, longitude });
  useEffect(() => {
    const controller = new AbortController();
    let dispose: (() => void) | undefined;
    localJSON("/api/maps", { signal: controller.signal })
      .then((region) => {
        if (controller.signal.aborted) return;
        if (!region.available)
          throw new Error("Install the offline basemap to use radar here.");
        const local = createLocalMap(
          canvas.current!,
          region,
          [initial.current.longitude, initial.current.latitude],
          6,
          10,
        );
        dispose = local.dispose;
        map.current = local.view;
        local.view.addControl(
          new maplibregl.ScaleControl({ unit: "imperial" }),
        );
        local.view.on("load", () => setReady(true));
        local.view.on("dragstart", () => setPlaying(false));
        local.view.on("zoomstart", () => setPlaying(false));
      })
      .catch((e) => {
        if (!controller.signal.aborted) setMapError(e.message);
      });
    return () => {
      controller.abort();
      dispose?.();
      map.current = null;
      shown.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.flyTo({ center: [longitude, latitude], zoom: 6 });
    const marker = new maplibregl.Marker({ color: "#123aff" })
      .setLngLat([longitude, latitude])
      .addTo(map.current);
    return () => {
      marker.remove();
    };
  }, [ready, latitude, longitude]);
  useEffect(() => {
    const controller = new AbortController();
    const update = async () => {
      if (document.hidden) return;
      try {
        const result = await localJSON("/api/briefing/radar", {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(18000),
          ]),
        });
        if (controller.signal.aborted) return;
        if (result.stale || !result.data?.frames?.length)
          throw new Error("Recent radar unavailable. Internet is required.");
        const next = result.data as Manifest;
        if (
          next.host !== "https://tilecache.rainviewer.com" ||
          next.frames.some(
            (f) => !/^\/v2\/radar\/[A-Za-z0-9_-]{1,64}$/.test(f.path),
          )
        )
          throw new Error("Radar source unavailable.");
        setManifest(next);
        setIndex(next.frames.length - 1);
        setError("");
        setPlaying(false);
      } catch (e) {
        if (!controller.signal.aborted) {
          setError((e as Error).message);
          setPlaying(false);
        }
      }
    };
    void update();
    const timer = setInterval(update, 300000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    const view = map.current,
      frame = manifest?.frames[index];
    if (!ready || !view || !manifest || !frame) return;
    const id = "radar-" + frame.time + "-" + refresh;
    let disposed = false,
      failed = false,
      loaded = false;
    if (shown.current === id) {
      setDisplayTime(frame.time);
      setLoading(false);
      return;
    }
    setLoading(true);
    setTileError("");
    view.addSource(id, {
      type: "raster",
      tiles: [`${manifest.host}${frame.path}/512/{z}/{x}/{y}/2/1_1.png`],
      tileSize: 512,
      maxzoom: 7,
      attribution: '<a href="https://www.rainviewer.com/">RainViewer</a>',
    });
    const label = view.getStyle().layers.find((l) => l.type === "symbol");
    view.addLayer(
      {
        id,
        type: "raster",
        source: id,
        paint: { "raster-opacity": 0, "raster-fade-duration": 0 },
      },
      label?.id,
    );
    const fail = () => {
      if (disposed) return;
      failed = true;
      setTileError(
        "Some radar tiles could not load. Last loaded frame retained.",
      );
      setLoading(false);
      setPlaying(false);
    };
    const check = (e: maplibregl.MapSourceDataEvent) => {
      if (disposed || failed || e.sourceId !== id || !view.isSourceLoaded(id))
        return;
      loaded = true;
      clearTimeout(timer);
      const old = shown.current;
      view.setPaintProperty(id, "raster-opacity", 0.72);
      shown.current = id;
      if (old && old !== id) {
        if (view.getLayer(old)) view.removeLayer(old);
        if (view.getSource(old)) view.removeSource(old);
      }
      setDisplayTime(frame.time);
      setLoading(false);
    };
    const onError = (e: maplibregl.ErrorEvent) => {
      if ("sourceId" in e && e.sourceId === id) fail();
    };
    view.on("sourcedata", check);
    view.on("error", onError);
    const timer = setTimeout(() => {
      if (!loaded) fail();
    }, 18000);
    return () => {
      disposed = true;
      clearTimeout(timer);
      view.off("sourcedata", check);
      view.off("error", onError);
      if (shown.current !== id) {
        if (view.getLayer(id)) view.removeLayer(id);
        if (view.getSource(id)) view.removeSource(id);
      }
    };
  }, [manifest, index, ready, refresh]);
  useEffect(() => {
    if (!playing || loading || error || tileError || !manifest) return;
    // Deliberately slow playback limits tile requests on the public API and Pi.
    const timer = setTimeout(
      () => setIndex((i) => (i + 1) % manifest.frames.length),
      10000,
    );
    return () => clearTimeout(timer);
  }, [playing, loading, index, manifest, error, tileError]);
  useEffect(() => {
    const stop = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", stop);
    return () => document.removeEventListener("visibilitychange", stop);
  }, []);
  const frames = manifest?.frames || [];
  const time = (n: number) =>
    new Date(n * 1000).toLocaleTimeString("en-US", {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
    });
  return (
    <section className="weather-radar" aria-label="Weather radar">
      <div className="radar-stage">
        <div
          ref={canvas}
          className="radar-canvas"
          aria-label={`Radar map centered on ${location}`}
        />
        <div className="radar-stamp">
          <span className="radar-dot" />
          <strong>
            {displayTime
              ? `Past radar · ${time(displayTime)}`
              : error
                ? "Radar unavailable"
                : "Loading radar…"}
          </strong>
          <small>
            {location} · {zone.split("/").at(-1)?.replaceAll("_", " ")}
          </small>
        </div>
        <div className="radar-zoom">
          <button
            aria-label="Zoom radar in"
            onClick={() => map.current?.zoomIn()}
          >
            <Plus size={18} />
          </button>
          <button
            aria-label="Zoom radar out"
            onClick={() => map.current?.zoomOut()}
          >
            <Minus size={18} />
          </button>
        </div>
        <button
          className="radar-center"
          aria-label="Center radar on weather location"
          onClick={() => {
            setPlaying(false);
            map.current?.flyTo({ center: [longitude, latitude], zoom: 6 });
          }}
        >
          <LocateFixed size={18} />
        </button>
        {loading && <span className="radar-loading">Loading frame…</span>}
        {(error || tileError) && (
          <p role="status" className="radar-error">
            {error || tileError}
            {displayTime
              ? ` Shown: ${time(displayTime)}.`
              : " No radar displayed."}
          </p>
        )}
        <div className="radar-key">
          <span>Light</span>
          <i />
          <span>Heavy</span>
        </div>
      </div>
      <div className="radar-controls">
        <button
          aria-label={
            playing ? "Pause radar animation" : "Play radar animation"
          }
          disabled={!frames.length || !!error || !!tileError || loading}
          onClick={() => setPlaying((v) => !v)}
        >
          {playing ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <label className="radar-timeline">
          <span>{frames[0] ? time(frames[0].time) : "Past two hours"}</span>
          <input
            type="range"
            aria-label="Radar history"
            aria-valuetext={
              frames[index] ? time(frames[index].time) : "Unavailable"
            }
            min={0}
            max={Math.max(0, frames.length - 1)}
            value={index}
            disabled={!frames.length || !!error}
            onChange={(e) => {
              setPlaying(false);
              setIndex(Number(e.target.value));
            }}
          />
          <span>{frames.at(-1) ? time(frames.at(-1)!.time) : "Latest"}</span>
        </label>
        <button
          disabled={!frames.length || !!error}
          onClick={() => {
            setPlaying(false);
            setIndex(frames.length - 1);
          }}
        >
          Latest
        </button>
        <button
          aria-label="Refresh radar"
          onClick={() => setRefresh((v) => v + 1)}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <p className="radar-footnote">
        Recent radar · online · frames every ~10 min · blank areas can mean no
        coverage, not necessarily dry weather.
      </p>
    </section>
  );
}
