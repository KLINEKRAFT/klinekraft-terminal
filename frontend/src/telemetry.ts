import { useEffect, useState } from "react";
import { initialReading, previewReading, type Reading } from "./preview";

import { isHostedDemo } from "./runtime";

export type DataMode = "preview" | "host";
type Connection = "connecting" | "ready" | "error";
export const emptyReading: Reading = {
  source: "host",
  sampledAt: null,
  stale: false,
  system: "Computer",
  architecture: "",
  cpu: null,
  cpuCores: null,
  memoryUsed: null,
  memoryTotal: null,
  storageUsed: null,
  storageTotal: null,
  temperature: null,
  interfaces: null,
};

function parseSnapshot(value: unknown): Reading {
  if (!value || typeof value !== "object") throw new Error("Invalid snapshot");
  const data = value as Record<string, unknown>;
  if (
    data.source !== "host" ||
    typeof data.sampledAt !== "string" ||
    !Number.isFinite(Date.parse(data.sampledAt)) ||
    typeof data.stale !== "boolean" ||
    typeof data.system !== "string" ||
    typeof data.architecture !== "string"
  )
    throw new Error("Invalid snapshot metadata");
  for (const key of [
    "cpu",
    "cpuCores",
    "memoryUsed",
    "memoryTotal",
    "storageUsed",
    "storageTotal",
    "temperature",
  ]) {
    const number = data[key];
    if (
      number !== null &&
      (typeof number !== "number" || !Number.isFinite(number))
    )
      throw new Error("Invalid measurement");
  }
  if (
    data.interfaces !== null &&
    (!Array.isArray(data.interfaces) ||
      !data.interfaces.every(
        (item) =>
          item &&
          typeof item.name === "string" &&
          typeof item.isUp === "boolean",
      ))
  )
    throw new Error("Invalid interface list");
  if (typeof data.cpu === "number" && (data.cpu < 0 || data.cpu > 100))
    throw new Error("Invalid CPU load");
  for (const key of ["batteryPercent", "batteryVoltage"]) {
    const value = data[key];
    if (value != null && (typeof value !== "number" || !Number.isFinite(value)))
      throw new Error("Invalid battery measurement");
  }
  if (data.batteryStatus != null && typeof data.batteryStatus !== "string")
    throw new Error("Invalid battery status");
  return data as unknown as Reading;
}

export function useTelemetry(paused: boolean, now: number) {
  const [mode, changeMode] = useState<DataMode>(() => {
    if (isHostedDemo) return "preview";
    try {
      return localStorage.getItem("klinekraft.dataMode.v1") === "preview"
        ? "preview"
        : "host";
    } catch {
      return "host";
    }
  });
  const [preview, setPreview] = useState(initialReading);
  const [host, setHost] = useState<Reading | null>(null);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [receivedAt, setReceivedAt] = useState(0);
  const [storageWarning, setStorageWarning] = useState("");

  const setMode = (next: DataMode) => {
    if (next === mode || (isHostedDemo && next === "host")) return;
    setHost(null);
    setReceivedAt(0);
    setConnection("connecting");
    changeMode(next);
    try {
      localStorage.setItem("klinekraft.dataMode.v1", next);
      setStorageWarning("");
    } catch {
      setStorageWarning(
        "Data mode could not be saved. This choice lasts until you reload.",
      );
    }
  };

  useEffect(() => {
    if (mode !== "preview" || paused) return;
    let tick = 0;
    const timer = setInterval(() => setPreview(previewReading(++tick)), 3000);
    return () => clearInterval(timer);
  }, [mode, paused]);

  useEffect(() => {
    if (isHostedDemo || mode !== "host" || paused) return;
    let stopped = false;
    let retry: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    async function poll() {
      controller = new AbortController();
      const deadline = setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetch("/api/system", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Backend unavailable");
        const snapshot = parseSnapshot(await response.json());
        if (!stopped) {
          setHost(snapshot);
          setReceivedAt(Date.now());
          setConnection("ready");
        }
      } catch {
        if (!stopped) setConnection("error");
      } finally {
        clearTimeout(deadline);
        if (!stopped) retry = setTimeout(poll, 3000);
      }
    }
    void poll();
    return () => {
      stopped = true;
      clearTimeout(retry);
      controller?.abort();
    };
  }, [mode, paused]);

  const stale =
    mode === "host" &&
    host !== null &&
    (host.stale || connection === "error" || now - receivedAt > 10000);
  const label =
    mode === "preview"
      ? paused
        ? "PREVIEW PAUSED"
        : "SIMULATED DATA"
      : paused
        ? "UPDATES PAUSED"
        : stale
          ? "STALE READINGS"
          : connection === "connecting"
            ? "CONNECTING"
            : connection === "error"
              ? "SERVICE OFFLINE"
              : "LIVE COMPUTER";
  const reading = mode === "preview" ? preview : (host ?? emptyReading);
  const detail =
    mode === "preview"
      ? "Simulated"
      : paused
        ? "Paused"
        : stale
          ? "Stale"
          : "Measured";
  return {
    mode,
    setMode,
    reading,
    label,
    detail,
    stale,
    connection,
    storageWarning,
  };
}

export function amount(value: number | null, digits = 1): string {
  return value === null ? "—" : value.toFixed(digits);
}
export function percent(
  used: number | null,
  total: number | null,
): number | null {
  return used === null || total === null || total <= 0
    ? null
    : Math.min(100, Math.max(0, (used / total) * 100));
}
export function networkSummary(reading: Reading): string {
  if (reading.interfaces === null) return "Unavailable";
  const count = reading.interfaces.filter((item) => item.isUp).length;
  return count
    ? `${count} link${count === 1 ? "" : "s"} up`
    : "No active links";
}
