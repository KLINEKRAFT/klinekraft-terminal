import { useEffect, useRef, useState } from "react";
import { Radio, Play, Square } from "lucide-react";
import { localJSON } from "./WikiReader";
import { isHostedDemo } from "../runtime";
type Station = { id: string; name: string; url: string };
export function RadioPlayer() {
  const [stations, setStations] = useState<Station[]>([]),
    [selected, setSelected] = useState("kexp");
  const [status, setStatus] = useState("Stopped"),
    [error, setError] = useState(""),
    [active, setActive] = useState(false);
  const [name, setName] = useState(""),
    [url, setUrl] = useState(""),
    [saving, setSaving] = useState(false);
  const panel = useRef<HTMLDetailsElement>(null),
    audio = useRef<HTMLAudioElement>(null),
    sequence = useRef(0);
  const ducked = useRef(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const station = stations.find((s) => s.id === selected);
  useEffect(() => {
    const controller = new AbortController();
    if (!isHostedDemo)
      void localJSON("/api/radio/stations", { signal: controller.signal })
        .then(setStations)
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        });
    const close = (e: PointerEvent) => {
      if (panel.current?.open && !panel.current.contains(e.target as Node))
        panel.current.open = false;
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && panel.current?.open) {
        panel.current.open = false;
        panel.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    const element = audio.current;
    return () => {
      controller.abort();
      sequence.current++;
      clearTimeout(timeout.current);
      element?.pause();
      element?.removeAttribute("src");
      element?.load();
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  function stop() {
    sequence.current++;
    clearTimeout(timeout.current);
    const el = audio.current!;
    el.pause();
    el.removeAttribute("src");
    el.load();
    setActive(false);
    setStatus("Stopped");
  }
  function fail(message: string) {
    stop();
    setError(message);
  }
  function buffer() {
    if (!audio.current?.getAttribute("src")) return;
    setStatus("Connecting…");
    clearTimeout(timeout.current);
    timeout.current = setTimeout(
      () => fail("Stream unavailable. Check internet and press Play to retry."),
      20000,
    );
  }
  async function play() {
    if (!station) return;
    stop();
    setError("");
    const attempt = sequence.current;
    audio.current!.src = station.url;
    audio.current!.volume = ducked.current ? .15 : 1;
    setActive(true);
    buffer();
    try {
      await audio.current!.play();
    } catch {
      if (attempt === sequence.current)
        fail(
          "Could not play this stream. Check internet or try another direct audio URL.",
        );
    }
  }
  const voiceHandlers = useRef({ play, stop });
  voiceHandlers.current = { play, stop };
  useEffect(() => {
    const duck = (event: Event) => {
      ducked.current = !!(event as CustomEvent<boolean>).detail;
      if (audio.current) audio.current.volume = ducked.current ? .15 : 1;
    };
    const command = (event: Event) => {
      const { action, complete } = (event as CustomEvent<{ action: string; complete: (message: string) => void }>).detail;
      if (action === "stop") { voiceHandlers.current.stop(); complete("Radio stopped."); }
      else void voiceHandlers.current.play().then(() => complete(audio.current?.paused ? "Radio could not start. Check the stream on screen." : "Radio playing."));
    };
    window.addEventListener("klinekraft-voice-duck", duck);
    window.addEventListener("klinekraft-voice-radio", command);
    return () => { window.removeEventListener("klinekraft-voice-duck", duck); window.removeEventListener("klinekraft-voice-radio", command); };
  }, []);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const saved: Station = await localJSON("/api/radio/stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url }),
      });
      setStations((old) =>
        old.some((s) => s.id === saved.id) ? old : [...old, saved],
      );
      setName("");
      setUrl("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!station || station.id === "kexp") return;
    setSaving(true);
    try {
      await localJSON("/api/radio/stations/" + station.id, {
        method: "DELETE",
      });
      stop();
      setStations((old) => old.filter((s) => s.id !== station.id));
      setSelected("kexp");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <details ref={panel} className="radio-control" name="terminal-information">
      <summary
        className="icon-button"
        aria-label="Internet radio"
        title={active ? "Radio · " + station?.name : "Internet radio"}
        data-playing={active}
      >
        <Radio size={18} />
      </summary>
      <audio
        ref={audio}
        preload="none"
        onPlaying={() => {
          clearTimeout(timeout.current);
          setStatus("Live");
        }}
        onWaiting={buffer}
        onError={() => {
          if (audio.current?.getAttribute("src"))
            fail("Stream unavailable. Check internet or station URL.");
        }}
        onEnded={() => fail("Stream ended. Press Play to reconnect.")}
      />
      <div className="radio-popover">
        <label htmlFor="radio-station">
          Radio <span>{status}</span>
        </label>
        <select
          id="radio-station"
          value={selected}
          disabled={saving}
          onChange={(e) => {
            stop();
            setError("");
            setSelected(e.target.value);
          }}
        >
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          className="radio-play"
          disabled={!station || isHostedDemo}
          onClick={() => (active ? stop() : void play())}
        >
          {active ? <Square size={15} /> : <Play size={15} />}{" "}
          {active ? "Stop radio" : "Play radio"}
        </button>
        <small>Internet required · use the speaker icon for volume.</small>
        <details className="radio-stations">
          <summary>Add station</summary>
          <form onSubmit={(e) => void add(e)}>
            <input
              aria-label="Station name"
              placeholder="Station name"
              value={name}
              maxLength={60}
              required
              onChange={(e) => setName(e.target.value)}
            />
            <input
              aria-label="Station stream URL"
              placeholder="https://… direct audio stream"
              type="url"
              value={url}
              maxLength={2048}
              required
              onChange={(e) => setUrl(e.target.value)}
            />
            <button disabled={saving || isHostedDemo}>Save station</button>
          </form>
          <small>
            Direct HTTPS MP3/AAC streams; website and playlist links may not
            play.
          </small>
        </details>
        {station?.id !== "kexp" && station && (
          <button disabled={saving} onClick={() => void remove()}>
            Remove selected station
          </button>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </details>
  );
}
