import { Terminal } from "lucide-react";
import type { Reading } from "../preview";
import { amount, type DataMode } from "../telemetry";

export function TelemetrySettings({
  mode,
  setMode,
  paused,
  setPaused,
  label,
}: {
  mode: DataMode;
  setMode: (mode: DataMode) => void;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  label: string;
}) {
  return (
    <section className="settings-panel">
      <h2>Workspace preferences</h2>
      <label className="setting-row">
        <span>
          <strong>Dashboard data</strong>
          <small>
            Live readings come from the computer running the local service.
          </small>
        </span>
        <select
          aria-label="Dashboard data"
          value={mode}
          onChange={(event) => setMode(event.target.value as DataMode)}
        >
          <option value="preview">Preview · simulated</option>
          <option value="host">Live computer</option>
        </select>
      </label>
      <label className="setting-row">
        <span>
          <strong>Automatic updates</strong>
          <small>
            Refresh approximately every 3 seconds. Preferences last this
            session.
          </small>
        </span>
        <input
          type="checkbox"
          checked={!paused}
          onChange={(event) => setPaused(!event.target.checked)}
        />
      </label>
      <p role="status">
        {label}.{" "}
        {mode === "host"
          ? "Start the Python service on your computer to connect. Missing sensors remain unavailable."
          : "Preview runs without Python or hardware. No machine readings are collected by the UI."}
      </p>
      <p>
        The clock always uses your browser’s local time. GPS and X1202
        integration are not configured.
      </p>
      <div className="feature-note">
        Browser launch, file management and a native desktop exit are still
        planned.
      </div>
    </section>
  );
}

export function SystemPanel({
  reading,
  label,
}: {
  reading: Reading;
  label: string;
}) {
  const measured = reading.source === "host";
  return (
    <section className="settings-panel">
      <h2>
        System overview <span className="inline-badge">{label}</span>
      </h2>
      <dl className="system-list">
        {[
          [
            measured ? "Service computer" : "Preview device",
            `${reading.system} ${reading.architecture}`,
          ],
          [
            "CPU load",
            reading.cpu === null
              ? "Unavailable"
              : `${amount(reading.cpu)}% · ${reading.cpuCores ?? "—"} logical cores`,
          ],
          [
            "Memory",
            `${amount(reading.memoryUsed)} / ${amount(reading.memoryTotal)} GB`,
          ],
          [
            "Root volume storage",
            `${amount(reading.storageUsed)} / ${amount(reading.storageTotal)} GB`,
          ],
          [
            "CPU temperature",
            reading.temperature === null
              ? "Unavailable on this host"
              : `${amount(reading.temperature)}°C`,
          ],
          ["X1202 / GPS", "Unavailable · integration not configured"],
          [
            "Last sample",
            reading.sampledAt
              ? new Date(reading.sampledAt).toLocaleTimeString()
              : measured
                ? "No sample received"
                : "Simulated fixture",
          ],
        ].map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="feature-note">
        <Terminal size={16} />
        Read-only telemetry. Commands do not execute a shell.
      </div>
    </section>
  );
}

export function NetworkPanel({
  reading,
  label,
}: {
  reading: Reading;
  label: string;
}) {
  return (
    <section className="settings-panel">
      <h2>
        Network interfaces <span className="inline-badge">{label}</span>
      </h2>
      <p>
        Link state does not establish internet access. VPNs and virtual adapters
        may appear here. No connectivity probes are sent.
      </p>
      {reading.interfaces === null ? (
        <p>
          Interface information is unavailable. Connect the local service in
          Settings.
        </p>
      ) : reading.interfaces.length === 0 ? (
        <p>No non-loopback interfaces were reported.</p>
      ) : (
        <dl className="system-list network-list">
          {reading.interfaces.map((item) => (
            <div key={item.name}>
              <dt>{item.name}</dt>
              <dd>{item.isUp ? "Link up" : "Link down"}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="feature-note">
        Wi-Fi names, IP addresses and network configuration controls are not
        collected in this milestone.
      </div>
    </section>
  );
}
