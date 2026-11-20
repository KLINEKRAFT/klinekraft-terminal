import { DirectListen } from "./SpeechControls";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  Wind,
  Droplets,
} from "lucide-react";
export type Forecast = {
  timezone?: string;
  current?: Record<string, number | string | null>;
  hourly?: Record<string, (number | null)[] | string[]>;
  daily?: Record<string, (number | null)[] | string[]>;
};
export type ForecastFeed = {
  data?: Forecast;
  stale: boolean;
  updated?: number;
  error?: string;
};
const finite = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);
export const reading = (n: unknown, suffix = "") =>
  finite(n) ? `${Math.round(n)}${suffix}` : "—";
export function condition(code: unknown) {
  if (!finite(code)) return "Conditions unavailable";
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorms";
}
export function WeatherGlyph({
  code,
  night = false,
  size = 24,
}: {
  code: unknown;
  night?: boolean;
  size?: number;
}) {
  const Icon = !finite(code)
    ? Cloud
    : code === 0
      ? night
        ? Moon
        : Sun
      : code <= 2
        ? CloudSun
        : code === 3
          ? Cloud
          : code <= 48
            ? CloudFog
            : code <= 67
              ? CloudRain
              : code <= 77
                ? CloudSnow
                : code <= 82
                  ? CloudRain
                  : code <= 86
                    ? CloudSnow
                    : CloudLightning;
  return <Icon size={size} strokeWidth={1.4} aria-hidden="true" />;
}
const clock = (value: unknown) => {
  if (typeof value !== "string" || !/T\d\d:\d\d/.test(value)) return "—";
  const h = Number(value.slice(11, 13));
  return `${h % 12 || 12}${value.slice(14, 16) !== "00" ? ":" + value.slice(14, 16) : ""} ${h < 12 ? "AM" : "PM"}`;
};
function localNow(zone: string) {
  try {
    return (
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23",
      })
        .format(new Date())
        .replace(" ", "T")
        .slice(0, 13) + ":00"
    );
  } catch {
    return new Date().toISOString().slice(0, 13) + ":00";
  }
}
export function weatherSummary(feed: ForecastFeed | undefined, location: string) {
  const data = feed?.data;
  const today = localNow(data?.timezone || "America/Chicago").slice(0,10);
  const lines = ["Weather in " + location + " today."];
  if (!data) return lines.concat("No saved forecast is available.").join("\n\n");
  if (feed?.stale) lines.push("This is a saved forecast. Current weather could not be confirmed.");
  const days = data.daily;
  const i = (days?.time || []).findIndex(value => value === today);
  if (i >= 0) {
    lines.push("Today: " + condition(days?.weather_code?.[i]) + ".");
    const high = days?.temperature_2m_max?.[i], low = days?.temperature_2m_min?.[i];
    if (finite(high) && finite(low)) lines.push("High " + Math.round(high) + ", low " + Math.round(low) + " degrees Fahrenheit.");
    const rain = days?.precipitation_probability_max?.[i];
    if (finite(rain)) lines.push("Chance of precipitation " + Math.round(rain) + " percent.");
    const wind = days?.wind_speed_10m_max?.[i];
    if (finite(wind)) lines.push("Maximum forecast wind " + Math.round(wind) + " miles per hour.");
    if (days?.sunset?.[i]) lines.push("Sunset " + clock(days.sunset[i]) + ", local time.");
  } else lines.push("Today's forecast is not available in this saved data.");
  const current = data.current;
  if (current && String(current.time || "").startsWith(today)) {
    lines.push("Latest model estimate: " + condition(current.weather_code) + ".");
    if (finite(current.temperature_2m)) lines.push(Math.round(current.temperature_2m) + " degrees Fahrenheit.");
    if (finite(current.apparent_temperature)) lines.push("Feels like " + Math.round(current.apparent_temperature) + " degrees.");
  }
  lines.push("Check Events for weather alerts.");
  return lines.join("\n\n");
}
export function WeatherOverview({
  feed,
  location,
  onRadar,
  onSettings,
}: {
  feed?: ForecastFeed;
  location: string;
  onRadar: () => void;
  onSettings?: () => void;
}) {
  const data = feed?.data,
    c = data?.current,
    days = data?.daily,
    hours = data?.hourly;
  const zone = data?.timezone || "America/Chicago",
    now = localNow(zone);
  const indices = (hours?.time || [])
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => typeof t === "string" && t >= now)
    .slice(0, 24);
  const dayIndices = (days?.time || [])
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => typeof t === "string" && t >= now.slice(0, 10))
    .slice(0, 7);
  const temps = indices
    .map(({ i }) => hours?.temperature_2m?.[i])
    .filter(finite);
  const low = Math.min(...temps),
    high = Math.max(...temps),
    span = Math.max(1, high - low);
  const currentDay = dayIndices[0]?.i;
  return (
    <div className="weather-overview">
      <div className="weather-topline">
        <span className="k-eyebrow">{location}</span>
        <DirectListen className="k-btn k-btn--quiet" label="Weather summary" text={weatherSummary(feed, location)} />
        <span className={feed?.stale ? "feed-state stale" : "feed-state"}>
          {!data
            ? "Unavailable"
            : feed?.stale
              ? "Last saved / unavailable"
              : "Forecast updated"}{" "}
          ·{" "}
          {feed?.updated
            ? new Date(feed.updated * 1000).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })
            : "No saved forecast"}
        </span>
      </div>
      {!data ? (
        <div className="k-empty weather-empty">
          <Cloud size={32} aria-hidden="true" />
          <h3>Waiting for {location} weather</h3>
          <p>
            The first forecast is saved as soon as the deck reaches the
            internet. After that it stays available offline.
          </p>
          {onSettings && (
            <button className="k-btn" onClick={onSettings}>
              Change location
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="weather-main">
            <section className="weather-current" aria-label="Current weather">
              <div className="weather-condition">
                <WeatherGlyph
                  code={c?.weather_code}
                  night={c?.is_day === 0}
                  size={38}
                />
                <span>{condition(c?.weather_code)}</span>
              </div>
              <div className="weather-temperature">
                {reading(c?.temperature_2m)}
                <span>°F</span>
              </div>
              <p>
                Feels {reading(c?.apparent_temperature, "°")}{" "}
                <span>
                  H{" "}
                  {reading(
                    currentDay === undefined
                      ? null
                      : days?.temperature_2m_max?.[currentDay],
                    "°",
                  )}{" "}
                  · L{" "}
                  {reading(
                    currentDay === undefined
                      ? null
                      : days?.temperature_2m_min?.[currentDay],
                    "°",
                  )}
                </span>
              </p>
              <div className="weather-measures">
                <span>
                  <Wind size={14} />
                  {reading(c?.wind_speed_10m)} mph
                </span>
                <span>
                  <Droplets size={14} />
                  {reading(c?.relative_humidity_2m, "%")} humidity
                </span>
              </div>
              <small>
                {feed?.stale ? "Saved model estimate" : "Model estimate"} ·{" "}
                {clock(c?.time)} ·{" "}
                {zone.split("/").at(-1)?.replaceAll("_", " ")}
              </small>
            </section>
            <section className="weather-hourly" aria-label="Hourly forecast">
              <div className="weather-section-heading">
                <h2>Next 24 hours</h2>
                <button className="k-btn k-btn--quiet" onClick={onRadar}>
                  Open radar
                </button>
              </div>
              {!indices.length ? (
                <p>No upcoming hours in this saved forecast.</p>
              ) : (
                <div
                  className="weather-hour-scroll"
                  tabIndex={0}
                  aria-label="Scroll hourly forecast"
                >
                  <div className="weather-hour-track">
                    {indices.map(({ t, i }, n) => {
                      const value = hours?.temperature_2m?.[i];
                      return (
                        <div className="weather-hour" key={String(t)}>
                          <span>{clock(t)}</span>
                          <WeatherGlyph
                            code={hours?.weather_code?.[i]}
                            size={20}
                          />
                          <div className="hour-score">
                            <i
                              style={{
                                height: finite(value)
                                  ? `${25 + ((value - low) / span) * 75}%`
                                  : 0,
                              }}
                            />
                          </div>
                          <strong>{reading(value, "°")}</strong>
                          <small>
                            {reading(
                              hours?.precipitation_probability?.[i],
                              "%",
                            )}{" "}
                            rain
                          </small>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </div>
          <section className="weather-week" aria-label="7-day forecast">
            <div className="weather-section-heading">
              <h2>Seven days</h2>
              <span>Local time · °F · mph</span>
            </div>
            <div className="weather-days">
              {dayIndices.map(({ t, i }, n) => (
                <article key={String(t)}>
                  <span>
                    {n === 0 && t === now.slice(0, 10)
                      ? "Today"
                      : new Date(String(t) + "T12:00:00Z").toLocaleDateString(
                          "en-US",
                          { weekday: "short", timeZone: "UTC" },
                        )}
                  </span>
                  <WeatherGlyph code={days?.weather_code?.[i]} size={23} />
                  <strong>
                    {reading(days?.temperature_2m_max?.[i], "°")}{" "}
                    <small>{reading(days?.temperature_2m_min?.[i], "°")}</small>
                  </strong>
                  <small>
                    {reading(days?.precipitation_probability_max?.[i], "%")}{" "}
                    rain
                  </small>
                </article>
              ))}
            </div>
            {!dayIndices.length && (
              <p>This saved forecast has no upcoming days.</p>
            )}
          </section>
          <details className="weather-details">
            <summary>Sun, wind & source</summary>
            <div>
              <span>
                Sunrise{" "}
                {clock(
                  currentDay === undefined ? null : days?.sunrise?.[currentDay],
                )}
              </span>
              <span>
                Sunset{" "}
                {clock(
                  currentDay === undefined ? null : days?.sunset?.[currentDay],
                )}
              </span>
              <span>Gusts {reading(c?.wind_gusts_10m)} mph</span>
              <a
                href="https://open-meteo.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open-Meteo · CC BY 4.0 ↗
              </a>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
