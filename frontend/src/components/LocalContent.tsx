import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Download,
  File,
  Folder,
  FolderOpen,
  FolderX,
  RotateCw,
} from "lucide-react";
import { isHostedDemo } from "../runtime";

const headers = { "X-Klinekraft-Client": "local-ui" };
async function localFetch(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { headers, signal, cache: "no-store" });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw Object.assign(
      new Error(
        error?.detail ||
          "Local service unavailable. Check that Klinekraft is running on your Pi.",
      ),
      { status: response.status },
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

const roots = [
  ["documents", "Documents"],
  ["downloads", "Downloads"],
] as const;
const MAX_DOWNLOAD = 104857600;

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
  // The Documents or Downloads folder itself does not exist on this Pi.
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (isHostedDemo) return;
    const controller = new AbortController();
    setListing(null);
    setError("");
    setMissing(false);
    localFetch(
      `/api/files?${new URLSearchParams({ root, path })}`,
      controller.signal,
    )
      .then((r) => r.json())
      .then((data) => {
        if (!controller.signal.aborted) setListing(data);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (!path && (error as { status?: number }).status === 404)
          setMissing(true);
        else setError(errorMessage(error));
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
  const rootLabel = root === "documents" ? "Documents" : "Downloads";
  const parent = () => setPath(path.split("/").slice(0, -1).join("/"));
  const refresh = () => setRevision((x) => x + 1);
  return (
    <section className="lib-files" aria-labelledby="files-title">
      <h2 id="files-title" className="sr-only">
        Your files
      </h2>
      {isHostedDemo ? (
        <div className="k-empty">
          <FolderOpen size={32} aria-hidden="true" />
          <h3>Your Pi’s files</h3>
          <p>
            Files are available in the local Pi app. This web demo cannot
            access your Pi.
          </p>
        </div>
      ) : (
        <>
          <div className="lib-toolbar">
            <div className="lib-segmented" role="group" aria-label="Folder">
              {roots.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className="k-btn"
                  aria-pressed={root === value}
                  onClick={() => {
                    setRoot(value);
                    setPath("");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="lib-path">
              <button
                type="button"
                className="k-btn k-btn--quiet k-btn--icon"
                aria-label="Parent folder"
                disabled={!path}
                onClick={parent}
              >
                <ArrowLeft size={16} aria-hidden="true" />
              </button>
              <span>
                {rootLabel}
                {path && ` / ${path.split("/").join(" / ")}`}
              </span>
            </div>
            <button
              type="button"
              className="k-btn k-btn--quiet k-btn--icon"
              aria-label="Refresh files"
              title="Refresh files"
              onClick={refresh}
            >
              <RotateCw size={16} aria-hidden="true" />
            </button>
          </div>
          {error && (
            <p role="alert" className="lib-alert">
              {error}
            </p>
          )}
          {!listing && !error && !missing && (
            <p role="status" className="lib-note">
              Loading files…
            </p>
          )}
          {busy && (
            <p role="status" className="lib-note">
              Preparing download…
            </p>
          )}
          {missing && (
            <div className="k-empty">
              <FolderX size={32} aria-hidden="true" />
              <h3>No {rootLabel} folder on this Pi yet</h3>
              <p>
                Files shows ~/Documents and ~/Downloads. The setup script
                creates both; run it in the Pi’s Terminal, then check again.
              </p>
              <code>bash scripts/setup-local-content.sh</code>
              <button type="button" className="k-btn" onClick={refresh}>
                <RotateCw size={16} aria-hidden="true" /> Check again
              </button>
            </div>
          )}
          {listing && !listing.entries.length && (
            <div className="k-empty">
              <FolderOpen size={32} aria-hidden="true" />
              {path ? (
                <>
                  <h3>This folder is empty</h3>
                  <p>Nothing has been saved in {path.split("/").at(-1)} yet.</p>
                  <button type="button" className="k-btn" onClick={parent}>
                    <ArrowLeft size={16} aria-hidden="true" /> Back
                  </button>
                </>
              ) : (
                <>
                  <h3>{rootLabel} is empty</h3>
                  <p>
                    Copy files into ~/{rootLabel} on the Pi, from a USB stick or
                    the desktop file manager, and download copies here.
                  </p>
                  <button type="button" className="k-btn" onClick={refresh}>
                    <RotateCw size={16} aria-hidden="true" /> Check again
                  </button>
                </>
              )}
            </div>
          )}
          {!!listing?.entries.length && (
            <>
              <ul className="lib-file-list">
                {listing.entries.map((entry) => (
                  <li key={entry.name}>
                    {entry.directory ? (
                      <Folder size={18} aria-hidden="true" />
                    ) : (
                      <File size={18} aria-hidden="true" />
                    )}
                    {entry.directory ? (
                      <button
                        className="lib-file-name"
                        onClick={() =>
                          setPath([path, entry.name].filter(Boolean).join("/"))
                        }
                      >
                        {entry.name}
                      </button>
                    ) : (
                      <span className="lib-file-name">{entry.name}</span>
                    )}
                    <span className="lib-file-size">
                      {entry.directory ? "Folder" : bytes(entry.size)}
                    </span>
                    {!entry.directory ? (
                      <button
                        className="k-btn k-btn--quiet k-btn--icon"
                        disabled={busy || entry.size > MAX_DOWNLOAD}
                        title={
                          entry.size > MAX_DOWNLOAD
                            ? "Use the desktop file manager for files above 100 MB"
                            : "Download a copy"
                        }
                        aria-label={`Download ${entry.name}`}
                        onClick={() => void download(entry)}
                      >
                        <Download size={16} aria-hidden="true" />
                      </button>
                    ) : (
                      <span aria-hidden="true" />
                    )}
                  </li>
                ))}
              </ul>
              {listing.truncated && (
                <p className="lib-note">
                  Showing the first 500 available entries. Use the desktop file
                  manager for the complete folder.
                </p>
              )}
              <p className="lib-caption">
                Downloads save a copy of files up to 100 MB; originals stay
                untouched. Hidden files and links are not shown.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
