import { useEffect, useRef, useState } from "react";
import { localJSON } from "../components/WikiReader";
import { isHostedDemo } from "../runtime";
export type GpsFix = {
  available: boolean;
  connected?: boolean;
  message: string;
  fixAt?: string;
  latitude?: number;
  longitude?: number;
  mode?: number;
  satellitesVisible?: number | null;
  satellitesUsed?: number | null;
  accuracyFeet?: number | null;
  courseDegrees?: number | null;
  speedMph?: number | null;
};
export function freshGps(fix: GpsFix | null, now = Date.now()): boolean {
  const age = now - Date.parse(fix?.fixAt || "");
  return (
    !!fix?.available &&
    Number.isFinite(fix.latitude) &&
    Number.isFinite(fix.longitude) &&
    Math.abs(fix.latitude!) <= 90 &&
    Math.abs(fix.longitude!) <= 180 &&
    age >= -5000 &&
    age <= 30000
  );
}
export function useGps() {
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [now, setNow] = useState(Date.now());
  const last = useRef<GpsFix | null>(null);
  useEffect(() => {
    if (isHostedDemo) return;
    let disposed = false,
      busy = false;
    let request: AbortController | undefined;
    async function poll() {
      if (disposed || busy || document.hidden) return;
      busy = true;
      request = new AbortController();
      try {
        const next: GpsFix = await localJSON("/api/maps/gps", {
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(4500)]),
        });
        if (!disposed) {
          if (freshGps(next)) last.current = next;
          setFix(next);
          setNow(Date.now());
        }
      } catch {
        if (!disposed) setFix({ available: false, message: "GPS unavailable" });
      } finally {
        busy = false;
      }
    }
    const visibility = () => {
      if (!document.hidden) void poll();
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 3000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      request?.abort();
      clearInterval(timer);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  const current = freshGps(fix, now);
  const age = last.current?.fixAt
    ? Math.max(0, Math.floor((now - Date.parse(last.current.fixAt)) / 1000))
    : null;
  return { fix, current, age, lastFix: last.current };
}
export function courseLabel(degrees: number) {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][
    Math.round(degrees / 45) % 8
  ];
}
