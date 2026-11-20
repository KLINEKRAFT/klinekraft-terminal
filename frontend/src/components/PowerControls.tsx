import { useEffect, useId, useRef, useState } from "react";
import { Battery, BatteryCharging, BatteryWarning } from "lucide-react";
import { localJSON } from "./WikiReader";
type Power = {
  field: boolean;
  dim: boolean;
  percent: number | null;
  voltage: number | null;
  warning: string | null;
  reserveMinutes: number | null;
  guard: {
    externalPower?: boolean | null;
    shutdownSeconds: number | null;
    valid: boolean;
  } | null;
};
/**
 * One header button for everything about power: battery level at a glance,
 * and a popover with Field mode, Dim screen and what they do. Renders
 * nothing where the local service has no power controls.
 */
export function PowerControls() {
  const [power, setPower] = useState<Power | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const p = await localJSON("/api/power", { signal: controller.signal });
        if (!controller.signal.aborted) setPower(p);
      } catch {
        /* Unsupported preview hosts have no power controls. */
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.documentElement.classList.remove("field-mode");
    };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("field-mode", !!power?.dim);
  }, [power?.dim]);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLButtonElement>("[role=switch]")?.focus();
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target))
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  async function set(kind: "field" | "dim", enabled: boolean) {
    setBusy(true);
    setError("");
    try {
      setPower(
        await localJSON(`/api/power/${kind}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!power) return null;
  const charging = !!power.guard?.externalPower;
  const Icon = power.warning
    ? BatteryWarning
    : charging
      ? BatteryCharging
      : Battery;
  const level =
    power.percent == null ? null : `${power.percent.toFixed(0)}%`;
  const summary = [
    level ? `${level} battery` : "Battery level unknown",
    charging
      ? "External power"
      : power.reserveMinutes == null
        ? "Estimating discharge…"
        : `~${Math.floor(power.reserveMinutes / 60)}h ${power.reserveMinutes % 60}m to 15% reserve`,
  ].join(" · ");
  return (
    <div
      className="shell-power"
      onBlur={(event) => {
        // Keyboard focus leaving the button and popover closes it, so it never
        // stays open over a page the user has tabbed into. A null target
        // (a switch briefly disabled while saving) keeps it open.
        const next = event.relatedTarget as Node | null;
        if (next && !event.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <button
        ref={button}
        className="k-btn k-btn--quiet shell-power-button"
        data-warning={power.warning ?? undefined}
        aria-label={`Power · ${level ? `${level} battery` : "battery unknown"}`}
        aria-expanded={open}
        aria-controls={id}
        title={summary}
        onClick={() => setOpen(!open)}
      >
        <Icon size={18} aria-hidden="true" />
        {level && <span>{level}</span>}
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          className="shell-popover shell-power-panel"
          role="dialog"
          aria-labelledby={`${id}-title`}
        >
          <h2 id={`${id}-title`} className="k-eyebrow">
            Power
          </h2>
          <p className="shell-power-status">
            <Icon size={18} aria-hidden="true" /> {summary}
          </p>
          <button
            className="k-switch shell-switch-row"
            role="switch"
            aria-checked={power.field}
            disabled={busy}
            aria-label="Field mode"
            aria-describedby={`${id}-field`}
            onClick={() => void set("field", !power.field)}
          >
            <span aria-hidden="true">
              Field mode
              <small id={`${id}-field`}>Stops AirPlay and the idle AI model</small>
            </span>
          </button>
          <button
            className="k-switch shell-switch-row"
            role="switch"
            aria-checked={power.dim}
            disabled={busy}
            aria-label="Dim screen"
            aria-describedby={`${id}-dim`}
            onClick={() => void set("dim", !power.dim)}
          >
            <span aria-hidden="true">
              Dim screen
              <small id={`${id}-dim`}>Darkens Terminal, not the backlight</small>
            </span>
          </button>
          {error && <p role="alert">{error}</p>}
          <div className="shell-power-notes">
            <p>
              In Field mode, offline AI wakes when asked and sleeps after two
              idle minutes. Maps and references
              stay available. Start AirPlay manually when needed.
            </p>
            <p>
              Runtime uses the last 10–30 minutes of declining charge; charging
              or unstable readings reset it. It is not a guarantee.
            </p>
            <p>
              {power.guard
                ? "Battery guard active: sustained ≤8% with ≤3.60 V, or ≤3.35 V, followed by a 60-second shutdown countdown. Reconnect power to recover. Low-battery automatic shutdown has not been physically tested."
                : "Battery shutdown guard unavailable — do not rely on automatic protection."}
            </p>
          </div>
        </div>
      )}
      {(power.warning || power.guard?.shutdownSeconds != null) && (
        <div className="shell-power-alerts">
          {power.warning && (
            <p role="alert">
              <strong>
                {power.warning === "critical"
                  ? "Very low battery"
                  : "Low battery"}
                : {power.percent?.toFixed(0)}%.
              </strong>{" "}
              Save your work and connect power.
            </p>
          )}
          {power.guard?.shutdownSeconds != null && (
            <p role="alert">
              <strong>
                Battery protection: shutdown in about{" "}
                {power.guard.shutdownSeconds} seconds.
              </strong>{" "}
              Connect power now. Recovery cancels the countdown.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
