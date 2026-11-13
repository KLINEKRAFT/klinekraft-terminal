import { useEffect, useState } from "react";
import { Thermometer } from "lucide-react";

// Tulsa coordinates and Open-Meteo source from KLINEKRAFT/WEATHER.
const endpoint =
  "https://api.open-meteo.com/v1/forecast?latitude=36.154&longitude=-95.9928&current=temperature_2m&temperature_unit=fahrenheit&timeformat=unixtime&timezone=America%2FChicago";
const key = "klinekraft.weather.tulsa.v1";
type Weather = { temperature: number; time: number };
function valid(value: unknown): value is Weather {
  const w = value as Weather | null;
  return (
    !!w &&
    Number.isFinite(w.temperature) &&
    w.temperature > -150 &&
    w.temperature < 160 &&
    Number.isFinite(w.time) &&
    w.time > 0 &&
    w.time <= Date.now() + 300_000
  );
}
function cached(): Weather | null {
  try {
    const w: unknown = JSON.parse(localStorage.getItem(key) || "null");
    return valid(w) ? w : null;
  } catch {
    return null;
  }
}
export function OutsideWeather() {
  const [weather, setWeather] = useState<Weather | null>(cached);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let stopped = false;
    let controller: AbortController | undefined;
    async function refresh() {
      if (document.hidden) return;
      controller?.abort();
      controller = new AbortController();
      const request = controller;
      const timeout = window.setTimeout(() => request.abort(), 12_000);
      try {
        const response = await fetch(endpoint, { signal: request.signal });
        if (!response.ok) throw new Error("Weather unavailable");
        const data = await response.json();
        const w = {
          temperature: data.current?.temperature_2m,
          time: data.current?.time * 1000,
        };
        if (data.current_units?.temperature_2m !== "°F" || !valid(w))
          throw new Error("Invalid weather");
        if (stopped || request !== controller) return;
        setWeather(w);
        setFailed(false);
        try {
          localStorage.setItem(key, JSON.stringify(w));
        } catch {
          /* Cache is optional. */
        }
      } catch {
        if (!stopped && request === controller) setFailed(true);
      } finally {
        clearTimeout(timeout);
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15 * 60_000);
    const age = window.setInterval(() => setNow(Date.now()), 60_000);
    const online = () => void refresh();
    window.addEventListener("online", online);
    return () => {
      stopped = true;
      controller?.abort();
      clearInterval(timer);
      clearInterval(age);
      window.removeEventListener("online", online);
    };
  }, []);
  const stale = failed || (!!weather && now - weather.time > 45 * 60_000);
  const expired = !!weather && now - weather.time > 24 * 60 * 60_000;
  const time = weather
    ? new Date(weather.time).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/Chicago",
      })
    : "";
  return (
    <div className="outside-weather" aria-label="Tulsa outdoor temperature">
      <Thermometer size={16} aria-hidden="true" />
      <span className="eyebrow">TULSA · OUTSIDE</span>
      <strong>
        {weather && !expired ? `${Math.round(weather.temperature)}°F` : "—"}
      </strong>
      <small>
        {weather && !expired
          ? `${stale ? "Last known · " : ""}${time} CT`
          : failed || expired
            ? "Weather unavailable"
            : "Loading…"}
      </small>
      <a
        href="https://open-meteo.com/"
        target="_blank"
        rel="noreferrer"
        title="Weather data by Open-Meteo"
      >
        Open-Meteo
      </a>
    </div>
  );
}
