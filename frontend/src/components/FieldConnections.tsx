import { DetailsPanel } from "./DetailsPanel";
import { useEffect, useState } from "react";
import { localJSON } from "./WikiReader";
type Hotspot = {
  configured: boolean;
  active: boolean;
  ssid?: string;
  password?: string;
  url?: string;
  notice?: string;
};
type Mesh = {
  connected: boolean;
  ports: string[];
  nodes: { id: string; name: string }[];
  messages: {
    id: number;
    stamp: string;
    direction: string;
    peer: string;
    text: string;
    status: string;
  }[];
  notice: string;
};
export function FieldConnections() {
  const [hotspot, setHotspot] = useState<Hotspot | null>(null),
    [mesh, setMesh] = useState<Mesh | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [port, setPort] = useState(""),
    [message, setMessage] = useState(""),
    [destination, setDestination] = useState("^all");
  useEffect(() => {
    const request = new AbortController();
    const refresh = () =>
      // Hotspot and radio fail independently; one must not freeze the other.
      Promise.allSettled([
        localJSON("/api/hotspot", { signal: request.signal }),
        localJSON("/api/mesh", { signal: request.signal }),
      ]).then(([h, m]) => {
        if (request.signal.aborted) return;
        if (h.status === "fulfilled") setHotspot(h.value);
        if (m.status === "fulfilled") setMesh(m.value);
        const failed = [h, m].find((r) => r.status === "rejected");
        setError(failed ? (failed.reason as Error).message : "");
      });
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    return () => {
      request.abort();
      clearInterval(timer);
    };
  }, []);
  async function action(path: string, body?: object) {
    setBusy(true);
    setError("");
    try {
      const result = await localJSON(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (path.startsWith("/api/hotspot")) setHotspot(result);
      else setMesh(result);
      if (path.endsWith("/send")) setMessage("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="settings-panel field-connections"
      aria-label="Field connections"
    >
      <h2>Field connections</h2>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <DetailsPanel title={`Phone hotspot · ${hotspot?.active ? "On" : "Off"}`}>
        <p className="field-muted">
          Starting disconnects this Pi from its current Wi-Fi. Join the deck
          from your phone to browse only shared Emergency references. Your notes
          and chats remain private.
        </p>
        {hotspot?.configured ? (
          <>
            <p>
              Network: <strong>{hotspot.ssid}</strong>
            </p>
            <details className="field-secret">
              <summary>Show Wi-Fi password</summary>
              <code>{hotspot.password}</code>
            </details>
            <p>
              Open <strong>{hotspot.url}</strong> on your phone after joining.
            </p>
            <button
              className={hotspot.active ? "k-btn" : "k-btn k-btn--primary"}
              disabled={busy}
              onClick={() =>
                void action(`/api/hotspot/${hotspot.active ? "stop" : "start"}`)
              }
            >
              {hotspot.active
                ? "Stop hotspot"
                : "Start hotspot and disconnect Wi-Fi"}
            </button>
          </>
        ) : (
          <p className="field-muted">
            The hotspot is not configured on this deck yet.
          </p>
        )}
      </DetailsPanel>
      <DetailsPanel
        title={`Off-grid messages · ${mesh?.connected ? "Radio connected" : "No radio connected"}`}
      >
        {mesh?.notice && <p className="field-muted">{mesh.notice}</p>}
        {!mesh?.connected ? (
          <div className="field-inline">
            <label className="k-label">
              Meshtastic USB radio
              <select
                className="k-select"
                value={port}
                disabled={!mesh?.ports.length}
                onChange={(e) => setPort(e.target.value)}
              >
                <option value="">Choose attached radio</option>
                {mesh?.ports.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <button
              className="k-btn k-btn--primary"
              disabled={busy || !port}
              onClick={() => void action("/api/mesh/connect", { port })}
            >
              Connect radio
            </button>
            {!mesh?.ports.length && (
              <p className="field-muted field-inline-note">
                Attach a configured Meshtastic USB radio. The Pi’s built-in
                Wi-Fi and Bluetooth cannot transmit LoRa messages.
              </p>
            )}
          </div>
        ) : (
          <button
            className="k-btn"
            disabled={busy}
            onClick={() => void action("/api/mesh/disconnect")}
          >
            Disconnect radio
          </button>
        )}
        {mesh?.connected && (
          <form
            className="field-form"
            onSubmit={(e) => {
              e.preventDefault();
              void action("/api/mesh/send", { text: message, destination });
            }}
          >
            <label className="k-label">
              Recipient
              <select
                className="k-select"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              >
                <option value="^all">Broadcast · primary channel</option>
                {mesh?.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="k-label">
              Message
              <textarea
                className="k-field"
                rows={3}
                maxLength={200}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            <p className="field-muted">
              Uses the radio’s existing channel settings. Delivery and privacy
              depend on that configuration.
            </p>
            <button
              className="k-btn k-btn--primary"
              disabled={
                busy ||
                !mesh?.connected ||
                !message.trim() ||
                new TextEncoder().encode(message).length > 200
              }
            >
              Send over radio
            </button>
          </form>
        )}
        {!!mesh?.messages.length && (
          <ul className="field-messages">
            {mesh.messages.map((m) => (
              <li key={m.id}>
                <small>
                  {m.direction} · {m.peer} ·{" "}
                  {new Date(m.stamp).toLocaleString()}
                </small>
                <p>{m.text}</p>
                <small>{m.status}</small>
              </li>
            ))}
          </ul>
        )}
      </DetailsPanel>
    </section>
  );
}
