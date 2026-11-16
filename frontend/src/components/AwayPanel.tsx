import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Maximize2, Moon, Settings2, X } from "lucide-react";
import { AwayCanvas } from "./AwayCanvas";
import type { Background } from "../awayShaders";

type Preferences = {
  background: Background;
  colors: [string, string, string];
  ink: string;
  message: string;
  ticker: boolean;
  font: "sans" | "mono";
  paused: boolean;
  logo: boolean;
  idleMinutes: number;
};
const defaults: Preferences = {
  background: "gradient",
  colors: ["#080b10", "#28303b", "#10131b"],
  ink: "#f2f0ea",
  message: "",
  ticker: false,
  font: "sans",
  paused: false,
  logo: true,
  idleMinutes: 2,
};
const storageKey = "klinekraft.away.v1";
const hex = (v: unknown): v is string =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
function readPreferences(): Preferences {
  try {
    const p = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!p) return defaults;
    return {
      background: ["gradient", "contour", "chrome"].includes(p.background)
        ? p.background
        : defaults.background,
      colors:
        Array.isArray(p.colors) && p.colors.length === 3 && p.colors.every(hex)
          ? p.colors
          : defaults.colors,
      ink: hex(p.ink) ? p.ink : defaults.ink,
      message:
        typeof p.message === "string"
          ? p.message.slice(0, 160)
          : defaults.message,
      ticker: p.ticker === true,
      font: p.font === "mono" ? "mono" : "sans",
      paused: p.paused === true,
      logo: p.logo !== false,
      idleMinutes: [0, 1, 2, 5, 10].includes(p.idleMinutes) ? p.idleMinutes : 2,
    };
  } catch {
    return defaults;
  }
}
export function AwayLaunch() {
  return <button className="away-launch" onClick={() => window.dispatchEvent(new Event("klinekraft-open-away"))}>
    <Moon size={15} /> Away <span>↗</span>
  </button>;
}
export function AwayPanel() {
  const [mode, setMode] = useState<"settings" | "idle" | null>(null);
  useEffect(() => {
    const open = () => setMode("settings");
    window.addEventListener("klinekraft-open-away", open);
    return () => window.removeEventListener("klinekraft-open-away", open);
  }, []);
  useEffect(() => {
    if (mode) return;
    let lastActivity = Date.now();
    const active = () => { lastActivity = Date.now(); };
    const events = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart", "focus"];
    events.forEach(event => window.addEventListener(event, active, { passive: true }));
    document.addEventListener("visibilitychange", active);
    const timer = window.setInterval(() => {
      const minutes = readPreferences().idleMinutes;
      if (document.hidden || !document.hasFocus() || document.querySelector("dialog[open]")) {
        lastActivity = Date.now(); return;
      }
      if (minutes && Date.now() - lastActivity >= minutes * 60000) setMode("idle");
    }, 1000);
    return () => {
      clearInterval(timer);
      events.forEach(event => window.removeEventListener(event, active));
      document.removeEventListener("visibilitychange", active);
    };
  }, [mode]);
  return mode && <AwayDialog automatic={mode === "idle"} onClose={() => setMode(null)} />;
}
function AwayDialog({ onClose, automatic }: { onClose: () => void; automatic: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const [preferences, setPreferences] = useState(readPreferences);
  const [presenting, setPresenting] = useState(automatic);
  const [controls, setControls] = useState(!automatic);
  const [storageError, setStorageError] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const element = dialog.current!;
    const fullscreenTarget = surface.current!;
    element.showModal();
    const onFullscreen = () =>
      setFullscreen(document.fullscreenElement === fullscreenTarget);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreen);
      if (document.fullscreenElement === fullscreenTarget)
        void document.exitFullscreen().catch(() => {});
      element.close();
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(preferences));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [preferences]);
  useEffect(() => {
    if (!presenting) return;
    const timer = window.setTimeout(() => {
      if (!dialog.current?.querySelector(":focus-visible")) setControls(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [presenting, controls]);
  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPreferences((p) => ({ ...p, [key]: value }));
  }
  async function toggleFullscreen() {
    setFullscreenError("");
    try {
      if (document.fullscreenElement === surface.current)
        await document.exitFullscreen();
      else await surface.current?.requestFullscreen();
    } catch {
      setFullscreenError(
        "Fullscreen is unavailable. You can still use Away in this window.",
      );
    }
  }
  const message = preferences.message.trim();
  const style = {
    "--away-ink": preferences.ink,
    "--away-font": preferences.font === "mono" ? "var(--mono)" : "var(--sans)",
    "--ticker-duration": `${Math.max(24, message.length * 0.45)}s`,
    background: `linear-gradient(135deg, ${preferences.colors.join(", ")})`,
  } as CSSProperties;
  return (
    <dialog
      ref={dialog}
      className={`away-dialog ${presenting ? "is-presenting" : ""}`}
      aria-label="Away screen"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        ref={surface}
        className={`away-surface ${presenting ? "is-presenting" : ""}`}
      >
        <div
          className={`away-stage ${preferences.paused ? "is-paused" : ""} ${controls ? "" : "controls-hidden"}`}
          style={style}
          onWheel={() => automatic ? onClose() : setControls(true)}
          onPointerMove={() => automatic ? onClose() : setControls(true)}
          onPointerDown={(event) => { if (automatic) { event.preventDefault(); onClose(); } else setControls(true); }}
          onKeyDown={(event) => { if (automatic) { event.preventDefault(); event.stopPropagation(); onClose(); } else setControls(true); }}
        >
          <AwayCanvas
            background={preferences.background}
            colors={preferences.colors}
            paused={preferences.paused}
          />
          {preferences.logo && <div className="away-logo-drift"><img src="/brand/lockup-640.png" alt="Klinekraft Terminal" /></div>}
          {message && <div
            className={
              preferences.ticker ? "away-message away-ticker" : "away-message"
            }
            aria-label={message}
          >
            {preferences.ticker ? (
              <div className="away-ticker-track" aria-hidden="true">
                <span>{message}</span>
                <span>{message}</span>
              </div>
            ) : (
              <p>{message}</p>
            )}
          </div>}
          <div className="away-stage-controls">
            {presenting && (
              <button
                onClick={() => {
                  setPresenting(false);
                  setControls(true);
                  requestAnimationFrame(() => startButton.current?.focus());
                }}
              >
                <Settings2 size={16} /> Settings
              </button>
            )}
            <button
              onClick={() => void toggleFullscreen()}
              aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              <Maximize2 size={16} />
            </button>
            <button onClick={onClose} aria-label="Close Away">
              <X size={17} />
            </button>
          </div>
          {fullscreenError && (
            <p className="away-notice" role="status">
              {fullscreenError}
            </p>
          )}
        </div>
        {!presenting && (
          <div className="away-settings">
            <header>
              <div>
                <span className="eyebrow">A MOMENT AWAY</span>
                <h2>Leave a little space.</h2>
              </div>
              <button
                ref={startButton}
                className="away-start"
                onClick={(event) => {
                  event.currentTarget.blur();
                  setPresenting(true);
                  setControls(true);
                }}
              >
                Start Away <span>↗</span>
              </button>
            </header>
            <label className="away-field">
              Message
              <input
                autoComplete="off"
                maxLength={160}
                value={preferences.message}
                onChange={(event) => update("message", event.target.value)}
                placeholder="Leave blank for no text"
              />
            </label>
            <div className="away-options">
              <label className="away-field">Automatic Away
                <select aria-label="Automatic Away" value={preferences.idleMinutes} onChange={event => update("idleMinutes", Number(event.target.value))}>
                  <option value={0}>Off</option>{[1, 2, 5, 10].map(minutes => <option key={minutes} value={minutes}>After {minutes} min idle</option>)}
                </select>
              </label>
              <label className="away-field">
                Background
                <select
                  aria-label="Background"
                  value={preferences.background}
                  onChange={(event) =>
                    update("background", event.target.value as Background)
                  }
                >
                  <option value="gradient">Gradient drift</option>
                  <option value="contour">Contour lines</option>
                  <option value="chrome">Liquid chrome</option>
                </select>
              </label>
              <label className="away-field">
                Typeface
                <select
                  aria-label="Typeface"
                  value={preferences.font}
                  onChange={(event) =>
                    update("font", event.target.value as Preferences["font"])
                  }
                >
                  <option value="sans">Inter</option>
                  <option value="mono">IBM Plex Mono</option>
                </select>
              </label>
              <fieldset className="away-colors">
                <legend>Colors</legend>
                {preferences.colors.map((color, index) => (
                  <label key={index}>
                    <span className="sr-only">
                      Background color {index + 1}
                    </span>
                    <input
                      type="color"
                      value={color}
                      onChange={(event) => {
                        const colors = [
                          ...preferences.colors,
                        ] as Preferences["colors"];
                        colors[index] = event.target.value;
                        update("colors", colors);
                      }}
                    />
                  </label>
                ))}
                <label>
                  <span className="sr-only">Message color</span>
                  <input
                    type="color"
                    value={preferences.ink}
                    onChange={(event) => update("ink", event.target.value)}
                  />
                </label>
              </fieldset>
            </div>
            <footer>
              <label><input type="checkbox" checked={preferences.logo} onChange={event => update("logo", event.target.checked)} /> Floating white logo</label>
              <button onClick={() => setPreferences(p => ({...p, colors: defaults.colors, background: "gradient", message: "", logo: true}))}>Dark logo preset</button>
              <label>
                <input
                  type="checkbox"
                  checked={preferences.ticker}
                  onChange={(event) => update("ticker", event.target.checked)}
                />{" "}
                Ticker message
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={preferences.paused}
                  onChange={(event) => update("paused", event.target.checked)}
                />{" "}
                Pause motion
              </label>
              <button onClick={() => setPreferences(defaults)}>Reset</button>
            </footer>
            <p className="away-hint">
              Blank message hides text. Automatic Away runs while Terminal is active; input returns to your work. Display sleep still applies.
            </p>
            {storageError && (
              <p role="status">
                Settings work for this session, but could not be saved.
              </p>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}
