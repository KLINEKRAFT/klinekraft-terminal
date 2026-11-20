import { Listen } from "./Listen";
import { localJSON } from "./WikiReader";
import { freshGps, courseLabel } from "../hooks/useGps";
import { condition } from "./WeatherOverview";
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const checked = (n?: number) => n ? new Date(n * 1000).toLocaleString() : "unknown";
export async function prepareBriefing() {
  const endpoints = ["/api/briefing", "/api/system", "/api/maps/gps"];
  const results = await Promise.allSettled(endpoints.map(url => localJSON(url, {signal: AbortSignal.timeout(12000)})));
  const [feeds, system, gps] = results.map(r => r.status === "fulfilled" ? r.value : null);
  const lines = ["Field briefing. " + new Date().toLocaleString() + "."];
  if (system && !system.stale && Date.now() - Date.parse(system.sampledAt) < 60000) {
    lines.push(finite(system.batteryPercent) ? "Battery approximately " + Math.round(system.batteryPercent) + " percent." : "Battery reading unavailable.");
  } else lines.push("Current battery reading unavailable.");
  if (freshGps(gps)) {
    lines.push("GPS has a current position.");
    if (finite(gps.speedMph)) lines.push("Speed " + Math.round(gps.speedMph) + " miles per hour.");
    if (finite(gps.courseDegrees)) lines.push("Travel direction " + courseLabel(gps.courseDegrees) + ". This is direction of movement, not which way the deck is facing.");
  } else lines.push("GPS has no current position.");
  const forecast = feeds?.feeds?.forecast;
  const current = forecast?.data?.current;
  if (current) {
    lines.push("Weather for " + feeds.settings.location + ". " +
      (forecast.stale || !feeds.settings.enabled ? "Last known weather, not a live reading. " : "") +
      "Saved " + checked(forecast.updated) + ". " + condition(current.weather_code) + ".");
    if (finite(current.temperature_2m)) lines.push(Math.round(current.temperature_2m) + " degrees Fahrenheit.");
    if (finite(current.wind_speed_10m)) lines.push("Wind " + Math.round(current.wind_speed_10m) + " miles per hour.");
  } else lines.push("Weather unavailable.");
  const events = feeds?.events || [];
  const active = !feeds?.settings.enabled ? [] : events.filter((e: {stale: boolean}) => !e.stale);
  const incomplete = !feeds || !feeds.settings.enabled || ["weather","earthquakes","space"].some(name => !feeds.feeds[name] || feeds.feeds[name].stale);
  if (incomplete) lines.push("Some alert feeds are unavailable or outdated. This briefing cannot confirm current conditions.");
  if (active.length) {
    lines.push(active.length + " reports in your configured feeds.");
    for (const event of active.slice(0,3)) lines.push(event.kind + ". " + event.title + ". Report issued " + checked(event.issued) + ".");
    if (active.length > 3) lines.push("See Events for the remaining reports.");
  } else lines.push("No current reports in the available feeds. This is not an all-clear.");
  if (events.some((e: {stale:boolean}) => e.stale)) lines.push("Older reports remain available in Events.");
  if (feeds) lines.push("Alerts checked: " + ["weather","earthquakes","space"].map(name => name + " " + checked(feeds.feeds[name]?.updated)).join("; ") + ".");
  return lines.join("\n\n");
}
export function BriefMe() {
  return <Listen className="k-btn k-btn--quiet" title="Field briefing" label="Brief me" prepare={prepareBriefing} />;
}
