import { Terminal } from "lucide-react";
import { useGps } from "../hooks/useGps";
import { isHostedDemo } from "../runtime";
import type { Reading } from "../preview";
import { amount, type DataMode } from "../telemetry";

export function TelemetrySettings({
  mode,
  setMode,
  paused,
  setPaused,
  label,
  storageWarning,
}: {
  mode: DataMode;
  setMode: (mode: DataMode) => void;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  label: string;
  storageWarning: string;
}) {
  return (
    <section className="settings-panel">
      <h2>Workspace preferences</h2>
      <div className="pref-row">
        <span>
          <strong id="pref-data-title">Dashboard data</strong>
          <small id="pref-data-note">
            {isHostedDemo
              ? "Web demo · simulated data. Live readings require the local app on your Mac or Raspberry Pi."
              : "Live computer is the default. Your choice is saved in this browser."}
          </small>
        </span>
        <select
          className="k-select"
          aria-label="Dashboard data"
          aria-describedby="pref-data-note"
          disabled={isHostedDemo}
          value={mode}
          onChange={(event) => setMode(event.target.value as DataMode)}
        >
          <option value="preview">Preview · simulated</option>
          {!isHostedDemo && <option value="host">Live computer</option>}
        </select>
      </div>
      <div className="pref-row">
        <span>
          <strong>Automatic updates</strong>
          <small id="pref-updates-note">
            Refresh approximately every 3 seconds. Lasts this session.
          </small>
        </span>
        <button
          type="button"
          role="switch"
          className="k-switch"
          aria-label="Automatic updates"
          aria-describedby="pref-updates-note"
          aria-checked={!paused}
          onClick={() => setPaused(!paused)}
        />
      </div>
      {storageWarning && (
        <p role="status" className="pref-note">
          {storageWarning}
        </p>
      )}
      {label !== "LIVE COMPUTER" && (
        <p role="status" className="pref-note">
          {label}.{" "}
          {mode === "host"
            ? "Start the Python service on your computer to connect. Missing sensors remain unavailable."
            : "Preview runs without Python or hardware. No machine readings are collected by the UI."}
        </p>
      )}
      <p className="pref-note">
        The clock uses local time. Temperatures are shown in Fahrenheit.
      </p>
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
  const gps = useGps();
  // The deck has a GPS unit; when it is unplugged this is a temporary state,
  // never "unsupported".
  const gpsText = isHostedDemo
    ? "Available on the installed deck"
    : gps.current
      ? `${gps.fix?.mode === 3 ? "3D" : "2D"} fix${
          gps.fix?.satellitesUsed != null
            ? ` · ${gps.fix.satellitesUsed} satellites`
            : ""
        }`
      : gps.fix?.connected
        ? "Connected · searching for satellites"
        : gps.fix
          ? "Disconnected · reconnect the deck GPS unit"
          : "Checking…";
  return (
    <section className="settings-panel">
      <h2 className="sr-only">
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
              : `${amount((reading.temperature * 9) / 5 + 32)}°F`,
          ],
          [
            "X1202 battery",
            reading.batteryPercent == null
              ? (reading.batteryStatus ?? "Not configured")
              : `${reading.batteryPercent.toFixed(0)}% estimated · ${reading.batteryVoltage?.toFixed(2)} V`,
          ],
          ["GPS", gpsText],
          [
            "Last sample",
            reading.sampledAt
              ? new Date(reading.sampledAt).toLocaleTimeString("en-US", {
                  hour12: true,
                })
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
      <h2 className="sr-only">
        Network interfaces <span className="inline-badge">{label}</span>
      </h2>
      <p>
        Connected interfaces. An active link does not guarantee internet access.
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
