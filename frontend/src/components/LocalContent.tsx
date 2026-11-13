import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Download, File, Folder } from "lucide-react";
import { isHostedDemo } from "../runtime";

const headers = { "X-Klinekraft-Client": "local-ui" };
async function localFetch(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { headers, signal, cache: "no-store" });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      error?.detail ||
        "Local service unavailable. Check that Klinekraft is running on your Pi.",
    );
  }
  return response;
}
function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unable to reach the local service.";
}
function bytes(value: number) {
  return value < 1024
    ? `${value} B`
    : value < 1024 * 1024
      ? `${(value / 1024).toFixed(1)} KB`
      : `${(value / 1024 / 1024).toFixed(1)} MB`;
}

type Entry = {
  name: string;
  directory: boolean;
  size: number;
  modified: number;
};
type Listing = { entries: Entry[]; truncated: boolean };
export function FilesPanel() {
  const [root, setRoot] = useState("documents");
  const [path, setPath] = useState("");
  const [revision, setRevision] = useState(0);
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (isHostedDemo) return;
    const controller = new AbortController();
    setListing(null);
    setError("");
    localFetch(
      `/api/files?${new URLSearchParams({ root, path })}`,
      controller.signal,
    )
      .then((r) => r.json())
      .then((data) => {
        if (!controller.signal.aborted) setListing(data);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(errorMessage(error));
      });
    return () => controller.abort();
  }, [root, path, revision]);
  async function download(entry: Entry) {
    setBusy(true);
    setError("");
    try {
      const response = await localFetch(
        `/api/files/download?${new URLSearchParams({ root, path: [path, entry.name].filter(Boolean).join("/") })}`,
      );
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = entry.name;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="browser-panel" aria-labelledby="files-title">
      <h2 id="files-title" className="sr-only">
        Your files
      </h2>
      {isHostedDemo ? (
        <p className="browser-help">
          Files are available in the local Pi app. This web demo cannot access
          your Pi.
        </p>
      ) : (
        <>
          <div className="browser-actions file-tabs">
            {[
              ["documents", "Documents"],
              ["downloads", "Downloads"],
            ].map(([value, label]) => (
              <button
                key={value}
                className="browser-button"
                aria-pressed={root === value}
                onClick={() => {
                  setRoot(value);
                  setPath("");
                }}
              >
                {label}
              </button>
            ))}
            <button
              className="browser-button"
              onClick={() => setRevision((x) => x + 1)}
            >
              Refresh files
            </button>
          </div>
          <div className="file-location">
            <button
              className="browser-button"
              aria-label="Parent folder"
              disabled={!path}
              onClick={() => setPath(path.split("/").slice(0, -1).join("/"))}
            >
              <ArrowLeft size={15} />
            </button>
            <span>
              {root === "documents" ? "Documents" : "Downloads"}
              {path && ` / ${path}`}
            </span>
          </div>
          {error && (
            <p role="alert" className="browser-warning">
              {error}
            </p>
          )}
          {!listing && !error && (
            <p role="status" className="browser-help">
              Loading files…
            </p>
          )}
          {busy && (
            <p role="status" className="browser-help">
              Preparing download…
            </p>
          )}
          {listing && (
            <>
              {!listing.entries.length && (
                <p className="browser-help">This folder is empty.</p>
              )}
              <ul className="file-list">
                {listing.entries.map((entry) => (
                  <li key={entry.name}>
                    {entry.directory ? (
                      <Folder size={17} />
                    ) : (
                      <File size={17} />
                    )}
                    {entry.directory ? (
                      <button
                        className="file-name"
                        onClick={() =>
                          setPath([path, entry.name].filter(Boolean).join("/"))
                        }
                      >
                        {entry.name}
                      </button>
                    ) : (
                      <span className="file-name">{entry.name}</span>
                    )}
                    <span className="file-size">
                      {entry.directory ? "Folder" : bytes(entry.size)}
                    </span>
                    {!entry.directory && (
                      <button
                        className="browser-button"
                        disabled={busy || entry.size > 104857600}
                        title={
                          entry.size > 104857600
                            ? "Use the desktop file manager for files above 100 MB"
                            : "Download a copy"
                        }
                        aria-label={`Download ${entry.name}`}
                        onClick={() => void download(entry)}
                      >
                        <Download size={15} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {listing.truncated && (
                <p className="browser-help">
                  Showing the first 500 available entries. Use the desktop file
                  manager for the complete folder.
                </p>
              )}
            </>
          )}
        </>
      )}
      <details className="content-details">
        <summary>About files</summary>
        <p>
          Downloads save a copy; originals stay untouched. Files up to 100 MB
          are supported. Hidden files and links are excluded.
        </p>
      </details>
    </section>
  );
}

type Wiki = { ready: boolean; archives: string[]; url: string | null };
export function WikiPanel() {
  const [wiki, setWiki] = useState<Wiki | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (isHostedDemo) return;
    const controller = new AbortController();
    setError("");
    setWiki(null);
    localFetch("/api/wiki", controller.signal)
      .then((r) => r.json())
      .then((data) => {
        if (!controller.signal.aborted) setWiki(data);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(errorMessage(error));
      });
    return () => controller.abort();
  }, [revision]);
  return (
    <section className="browser-panel" aria-labelledby="wiki-title">
      <span className="eyebrow">OFFLINE KNOWLEDGE</span>
      <h2 id="wiki-title">Wikipedia</h2>
      <p className="browser-help">
        A reference library, even without a connection.
      </p>
      {isHostedDemo ? (
        <p className="browser-help">
          Offline Wikipedia runs in the local Pi app.
        </p>
      ) : (
        <>
          {error && (
            <p role="alert" className="browser-warning">
              {error}
            </p>
          )}
          {!wiki && !error && (
            <p role="status" className="browser-help">
              Checking offline reader…
            </p>
          )}
          {wiki && (
            <p role="status" className="wiki-status">
              {wiki.ready
                ? "Ready to read offline."
                : wiki.archives.length
                  ? "Your archive is saved. The reader is not running."
                  : "Your offline library is empty."}
            </p>
          )}
          <div className="browser-actions">
            {wiki?.ready && (
              <a
                className="browser-button"
                href="http://127.0.0.1:8081/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Wikipedia <ArrowUpRight size={15} />
              </a>
            )}
            <button
              className="browser-button"
              onClick={() => setRevision((x) => x + 1)}
            >
              Check reader
            </button>
          </div>
          {!!wiki?.archives.length && (
            <details className="content-details">
              <summary>Installed archives ({wiki.archives.length})</summary>
              <ul className="wiki-archives">
                {wiki.archives.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </details>
          )}
          <details className="content-details">
            <summary>
              {wiki?.ready ? "About offline reading" : "Set up Wikipedia"}
            </summary>
            <p>
              Download the English starter collection once, then read and search
              offline. It is a selection, not the full Wikipedia. Kiwix opens in
              a separate tab.
            </p>
            {!wiki?.ready && (
              <>
                <p>Run this in your Pi’s Terminal, then choose Check reader.</p>
                <pre>
                  cd ~/klinekraft-terminal{"\n"}bash
                  scripts/setup-local-content.sh
                </pre>
              </>
            )}
            <p>Archives are saved in Documents / Wikipedia.</p>
          </details>
        </>
      )}
    </section>
  );
}
