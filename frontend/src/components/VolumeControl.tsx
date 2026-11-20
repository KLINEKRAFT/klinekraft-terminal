import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { localJSON } from "./WikiReader";
import { isHostedDemo } from "../runtime";
type AudioState = { volume: number; muted: boolean };
export function VolumeControl() {
  const [state, setState] = useState<AudioState | null>(null),
    [error, setError] = useState("");
  const panel = useRef<HTMLDetailsElement>(null);
  const revision = useRef(0);
  const pending = useRef<Partial<AudioState> | null>(null),
    writing = useRef(false),
    alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    alive.current = true;
    let reading = false;
    const controller = new AbortController();
    async function refresh() {
      if (
        isHostedDemo ||
        document.hidden ||
        reading ||
        writing.current ||
        pending.current
      )
        return;
      reading = true;
      const version = revision.current;
      try {
        const next = await localJSON("/api/audio", {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(4000),
          ]),
        });
        if (
          alive.current &&
          version === revision.current &&
          !writing.current &&
          !pending.current
        ) {
          setState(next);
          setError("");
        }
      } catch {
        if (alive.current) setError("Audio unavailable");
      } finally {
        reading = false;
      }
    }
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
    void refresh();
    const poll = setInterval(() => void refresh(), 3000);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      alive.current = false;
      controller.abort();
      clearInterval(poll);
      clearTimeout(timer.current);
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  async function flush() {
    if (writing.current) return;
    writing.current = true;
    try {
      while (pending.current && alive.current) {
        const body = pending.current;
        pending.current = null;
        try {
          const next = await localJSON("/api/audio", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(5000),
          });
          if (alive.current && !pending.current) {
            setState(next);
            setError("");
          }
        } catch (e) {
          if (alive.current) setError((e as Error).message);
        }
      }
    } finally {
      writing.current = false;
    }
  }
  function update(change: Partial<AudioState>) {
    revision.current++;
    setState((old) => (old ? { ...old, ...change } : old));
    pending.current = { ...pending.current, ...change };
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 150);
  }
  return (
    <details ref={panel} className="volume-control" name="terminal-information">
      <summary
        aria-label="Computer volume"
        title="Computer volume"
        className="icon-button"
      >
        {state?.muted || state?.volume === 0 ? (
          <VolumeX size={18} />
        ) : (
          <Volume2 size={18} />
        )}
      </summary>
      <div className="volume-popover">
        <label htmlFor="computer-volume">
          Computer volume <output>{state ? state.volume + "%" : "—"}</output>
        </label>
        <input
          id="computer-volume"
          type="range"
          min="0"
          max="100"
          step="1"
          value={Math.min(100, state?.volume ?? 0)}
          disabled={!state || isHostedDemo}
          onChange={(e) => update({ volume: Number(e.target.value) })}
        />
        <button
          type="button"
          aria-pressed={state?.muted ?? false}
          disabled={!state || isHostedDemo}
          onClick={() => update({ muted: !state?.muted })}
        >
          {state?.muted ? "Unmute" : "Mute"}
        </button>
        <small>Default output · all apps</small>
        {error && <span role="alert">{error}</span>}
      </div>
    </details>
  );
}
