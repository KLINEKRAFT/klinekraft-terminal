import { useEffect, useState, type FormEvent } from "react";
import { isHostedDemo } from "../runtime";
import { localJSON } from "./WikiReader";

type ResearchFile = { id: number; collection: string; name: string; mime: string };
type Results = { files: ResearchFile[]; collections: string[]; limited: boolean };

export function ResearchLibrary({ onAsk }: { onAsk: (file: File) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [collection, setCollection] = useState("");
  const [root, setRoot] = useState("documents");
  const [path, setPath] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<File | null>(null);
  const [previewURL, setPreviewURL] = useState("");

  useEffect(() => {
    if (isHostedDemo) return;
    const request = new AbortController();
    const params = new URLSearchParams({ q: query, collection: filter });
    const timer = window.setTimeout(() => {
      void localJSON(`/api/research?${params}`, { signal: request.signal })
        .then((data: Results) => setResults(data))
        .catch((failure: Error) => {
          if (!request.signal.aborted) setError(failure.message);
        });
    }, 160);
    return () => {
      clearTimeout(timer);
      request.abort();
    };
  }, [query, filter, revision]);

  useEffect(() => {
    if (!preview) {
      setPreviewURL("");
      return;
    }
    const url = URL.createObjectURL(preview);
    setPreviewURL(url);
    return () => URL.revokeObjectURL(url);
  }, [preview]);

  async function importFolder(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const report = await localJSON("/api/research/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection, root, path }),
      });
      setMessage(`Imported ${report.imported} · skipped ${report.skipped}${report.limited ? " · first 50 supported files checked" : ""}`);
      setFilter("");
      setQuery("");
      setRevision((value) => value + 1);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function open(item: ResearchFile) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/research/${item.id}`, {
        headers: { "X-Klinekraft-Client": "local-ui" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Could not open this file.");
      setPreview(new File([await response.blob()], item.name.split("/").at(-1)!, { type: item.mime }));
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (isHostedDemo) return null;
  return (
    <section className="settings-panel research-library" aria-label="Research library">
      <h2>Research library</h2>
      <details>
        <summary>Import folder</summary>
        <form onSubmit={importFolder}>
          <label>Collection <input value={collection} required maxLength={80}
            onChange={(event) => setCollection(event.target.value)} /></label>
          <label>Location <select value={root} onChange={(event) => setRoot(event.target.value)}>
            <option value="documents">Documents</option>
            <option value="downloads">Downloads</option>
          </select></label>
          <label>Folder inside location <input value={path} required maxLength={1024}
            placeholder="e.g. Research/Physics" onChange={(event) => setPath(event.target.value)} /></label>
          <button disabled={busy || !collection.trim() || !path.trim()}>Import</button>
        </form>
        <p>PDFs, images and text notes up to 8 MiB. Imported files are copied to the Pi library.</p>
      </details>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <div className="research-fields">
        <label>Search files <input type="search" value={query} maxLength={200}
          onChange={(event) => setQuery(event.target.value)} /></label>
        <label>Collection <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="">All collections</option>
          {results?.collections.map((name) => <option key={name}>{name}</option>)}
        </select></label>
      </div>
      {results && !results.files.length && <p>{query ? "No matching files." : "No files in this view."}</p>}
      {!!results?.files.length && <ul>
        {results.files.map((file) => <li key={file.id}>
          <button disabled={busy} onClick={() => void open(file)}>{file.name}</button>
          <span>{file.collection}</span>
        </li>)}
      </ul>}
      {results?.limited && <p>Showing the first 100 results. Narrow your search to see more.</p>}
      {preview && previewURL && <section className="research-preview" aria-label="File preview">
        <h3>{preview.name}</h3>
        <button onClick={() => setPreview(null)}>Close preview</button>
        <button onClick={() => onAsk(preview)}>Ask about this</button>
        {preview.type.startsWith("image/")
          ? <img src={previewURL} alt={preview.name} />
          : <p><a href={previewURL} target="_blank" rel="noopener noreferrer">Open local preview</a></p>}
      </section>}
    </section>
  );
}
