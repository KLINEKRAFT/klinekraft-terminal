import { useEffect, useState } from "react";
import type { Reading } from "../preview";
import type { HistoryPoint } from "../telemetry";

export function rate(value: number | null | undefined) {
  if (value == null) return "—";
  return value >= 1e6
    ? `${(value / 1e6).toFixed(1)} MB/s`
    : value >= 1e3
      ? `${(value / 1e3).toFixed(1)} kB/s`
      : `${Math.round(value)} B/s`;
}
export function Sparkline({
  history,
  field,
  label,
  maximum = 100,
}: {
  history: HistoryPoint[];
  field: "cpu" | "memory" | "download" | "upload";
  label: string;
  maximum?: number;
}) {
  const end = history.at(-1)?.time ?? 0;
  let previous = 0;
  const path = history
    .map((p) => {
      const value = p[field];
      if (value == null) {
        previous = 0;
        return "";
      }
      const x = 300 - ((end - p.time) / 180000) * 300;
      const y =
        46 - Math.max(0, Math.min(1, value / Math.max(1, maximum))) * 42;
      const segment = `${previous && p.time - previous < 10000 ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
      previous = p.time;
      return segment;
    })
    .join(" ");
  return (
    <svg
      className="resource-graph"
      viewBox="0 0 300 50"
      preserveAspectRatio="none"
      role="img"
      aria-label={`${label}, last three minutes`}
    >
      <path className="graph-baseline" d="M0 46H300" />
      <path className="graph-line" d={path} />
      {history.length === 1 && history[0][field] != null && (
        <circle
          cx="300"
          cy={46 - Math.min(1, history[0][field]! / Math.max(1, maximum)) * 42}
          r="2"
        />
      )}
    </svg>
  );
}
export function ResourceGraphs({
  history,
  reading,
  label,
}: {
  history: HistoryPoint[];
  reading: Reading;
  label: string;
}) {
  const peak = Math.max(
    1024,
    ...history.flatMap((p) => [p.download ?? 0, p.upload ?? 0]),
  );
  return (
    <section className="resource-detail" aria-label="Resource history">
      <div className="section-heading">
        <h2>Activity</h2>
        <span>{label} · 3 MIN</span>
      </div>
      <div className="resource-grid">
        <article>
          <header>
            CPU{" "}
            <strong>
              {reading.cpu == null ? "—" : `${reading.cpu.toFixed(0)}%`}
            </strong>
          </header>
          <Sparkline history={history} field="cpu" label="CPU usage" />
          <small>0–100% · all cores</small>
        </article>
        <article>
          <header>
            Memory{" "}
            <strong>
              {reading.memoryUsed == null
                ? "—"
                : `${reading.memoryUsed.toFixed(1)} GB`}
            </strong>
          </header>
          <Sparkline history={history} field="memory" label="Memory usage" />
          <small>0–100% · used memory</small>
        </article>
        <article>
          <header>
            Download <strong>{rate(reading.networkDownload)}</strong>
          </header>
          <Sparkline
            history={history}
            field="download"
            label="Download rate"
            maximum={peak}
          />
          <small>Scale 0–{rate(peak)}</small>
        </article>
        <article>
          <header>
            Upload <strong>{rate(reading.networkUpload)}</strong>
          </header>
          <Sparkline
            history={history}
            field="upload"
            label="Upload rate"
            maximum={peak}
          />
          <small>Scale 0–{rate(peak)}</small>
        </article>
      </div>
      {history.length < 2 && (
        <p className="browser-help">
          {reading.source === "host"
            ? "History builds as live samples arrive."
            : "Switch to Live computer to collect history."}
        </p>
      )}
    </section>
  );
}
type Process = {
  pid: number;
  name: string;
  cpu: number | null;
  memoryBytes: number;
};
export function ProcessList({
  live,
  paused,
}: {
  live: boolean;
  paused: boolean;
}) {
  const [data, setData] = useState<{
    sampledAt: string | null;
    stale: boolean;
    processes: Process[] | null;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!live) {
      setData(null);
      return;
    }
    if (paused) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch("/api/processes", {
          headers: { "X-Klinekraft-Client": "local-ui" },
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(5000),
          ]),
        });
        if (!response.ok) throw Error();
        const value = await response.json();
        if (
          value.processes !== null &&
          (!Array.isArray(value.processes) ||
            !value.processes.every(
              (p: Process) =>
                Number.isInteger(p.pid) &&
                typeof p.name === "string" &&
                Number.isFinite(p.memoryBytes) &&
                (p.cpu === null || Number.isFinite(p.cpu)),
            ))
        )
          throw Error();
        if (!controller.signal.aborted) {
          setData(value);
          setFailed(false);
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, 3000);
      }
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [live, paused]);
  return (
    <section className="process-panel" aria-label="Processes">
      <div className="section-heading">
        <h2>Processes</h2>
        <span>
          {paused
            ? "PAUSED"
            : failed || data?.stale
              ? "STALE / UNAVAILABLE"
              : "READ ONLY"}
        </span>
      </div>
      {!live ? (
        <p className="browser-help">Available in Live computer mode.</p>
      ) : !data?.processes ? (
        <p className="browser-help">
          {failed || data
            ? "Process information unavailable."
            : "Reading processes…"}
        </p>
      ) : (
        <>
          <p className="browser-help">
            Top 12 by CPU, then memory. CPU is a share of total machine
            capacity.
          </p>
          <div className="process-scroll">
            <table>
              <thead>
                <tr>
                  <th>Process</th>
                  <th>PID</th>
                  <th>CPU</th>
                  <th>Memory</th>
                </tr>
              </thead>
              <tbody>
                {data.processes.map((p) => (
                  <tr key={p.pid}>
                    <td>{p.name}</td>
                    <td>{p.pid}</td>
                    <td>{p.cpu == null ? "—" : `${p.cpu.toFixed(1)}%`}</td>
                    <td>{(p.memoryBytes / 1e6).toFixed(1)} MB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.sampledAt && (
            <p className="browser-help">
              Sampled{" "}
              {new Date(data.sampledAt).toLocaleTimeString("en-US", {
                hour12: true,
              })}
            </p>
          )}
        </>
      )}
    </section>
  );
}
