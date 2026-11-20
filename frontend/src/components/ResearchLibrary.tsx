import { LocalImage } from "./LocalImage";
import { DocumentReader, type DocumentSource } from "./DocumentReader";
import { useEffect, useId, useState, type FormEvent } from "react";
import { FolderInput, Library, SearchX } from "lucide-react";
import { isHostedDemo } from "../runtime";
import { localJSON } from "./WikiReader";

type ResearchFile = {
  id: number;
  collection: string;
  name: string;
  mime: string;
  snippet?: string;
  page?: number | null;
  searchable?: boolean;
};
type Results = {
  files: ResearchFile[];
  collections: string[];
  limited: boolean;
  total?: number;
};

const layouts = [
  ["shelf", "Shelf"],
  ["grid", "Grid"],
  ["list", "List"],
] as const;
const title = (name: string) => name.replace(/\.(txt|pdf|md|html?)$/i, "");

export function ResearchLibrary({
  onAsk,
  initialQuery = "",
}: {
  onAsk: (file: File) => void;
  initialQuery?: string;
}) {
  const [mime, setMime] = useState("");
  const [layout, setLayout] = useState<string>("shelf");
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState("");
  const [collection, setCollection] = useState("");
  const [root, setRoot] = useState("documents");
  const [path, setPath] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<DocumentSource | null>(null);
  const importId = useId();

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("klinekraft:library-changed", refresh);
    return () =>
      window.removeEventListener("klinekraft:library-changed", refresh);
  }, []);
  useEffect(() => {
    if (isHostedDemo) return;
    const request = new AbortController();
    const params = new URLSearchParams({ q: query, collection: filter, mime });
    const timer = window.setTimeout(() => {
      void localJSON(`/api/research?${params}`, { signal: request.signal })
        .then((data: Results) => {
          setResults(data);
          setError("");
        })
        .catch((failure: Error) => {
          if (!request.signal.aborted) setError(failure.message);
        });
    }, 160);
    return () => {
      clearTimeout(timer);
      request.abort();
    };
  }, [query, filter, revision, mime]);

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
      setMessage(
        `Imported ${report.imported} · skipped ${report.skipped}${report.limited ? " · import limit reached; import again to continue" : ""}`,
      );
      setFilter("");
      setQuery("");
      setImporting(false);
      setRevision((value) => value + 1);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function open(item: ResearchFile) {
    setPreview({
      url: `/api/research/${item.id}`,
      title: item.name,
      mime: item.mime,
      page: item.page ?? undefined,
    });
  }
  function clearSearch() {
    setQuery("");
    setMime("");
    setFilter("");
  }

  if (isHostedDemo) return null;
  // The whole library is empty (not just this search or filter).
  const libraryEmpty =
    !!results &&
    !results.collections.length &&
    (results.total ?? results.files.length) === 0;
  const showToolbar = results ? !libraryEmpty || !!query : !!query;
  const filtered = !!(query || mime || filter);
  return (
    <section className="research-library lib-docs" aria-label="Research library">
      {showToolbar && (
        <div className="lib-toolbar">
          <input
            className="k-field lib-toolbar-grow"
            type="search"
            aria-label="Search files"
            placeholder="Search documents"
            value={query}
            maxLength={200}
            onChange={(event) => setQuery(event.target.value)}
          />
          {!libraryEmpty && (
            <>
              <select
                className="k-select"
                aria-label="Document format"
                value={mime}
                onChange={(e) => setMime(e.target.value)}
              >
                <option value="">All formats</option>
                <option value="application/pdf">PDF</option>
                <option value="text/plain">Text</option>
              </select>
              {!!results?.collections.length && (
                <select
                  className="k-select lib-collection-filter"
                  aria-label="Filter by collection"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  <option value="">All collections</option>
                  {results.collections.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              )}
              <div className="lib-segmented" role="group" aria-label="Layout">
                {layouts.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className="k-btn"
                    aria-pressed={layout === value}
                    onClick={() => setLayout(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
          <button
            type="button"
            className="k-btn"
            aria-expanded={importing}
            aria-controls={importId}
            onClick={() => setImporting((value) => !value)}
          >
            <FolderInput size={16} aria-hidden="true" /> Import
          </button>
        </div>
      )}
      {importing && (
        <form id={importId} className="k-card lib-import" onSubmit={importFolder}>
          <div className="lib-import-head">
            <h3>Import a folder</h3>
            <p>
              PDFs, images and text notes up to 8 MiB each are copied into the
              Pi library. Plug in a USB stick? Copy the folder into Documents
              or Downloads first.
            </p>
          </div>
          <div className="lib-form-row">
            <label className="k-label">
              Collection
              <input
                className="k-field"
                value={collection}
                required
                maxLength={80}
                placeholder="e.g. Survival"
                onChange={(event) => setCollection(event.target.value)}
              />
            </label>
            <label className="k-label">
              Location
              <select
                className="k-select"
                value={root}
                onChange={(event) => setRoot(event.target.value)}
              >
                <option value="documents">Documents</option>
                <option value="downloads">Downloads</option>
              </select>
            </label>
            <label className="k-label lib-grow">
              Folder inside location
              <input
                className="k-field"
                value={path}
                required
                maxLength={1024}
                placeholder="e.g. Research/Physics"
                onChange={(event) => setPath(event.target.value)}
              />
            </label>
          </div>
          <div className="lib-actions">
            <button
              type="submit"
              className="k-btn k-btn--primary"
              disabled={busy || !collection.trim() || !path.trim()}
            >
              {busy ? "Importing…" : "Import"}
            </button>
            <button
              type="button"
              className="k-btn k-btn--quiet"
              onClick={() => setImporting(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {message && (
        <p role="status" className="lib-note">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="lib-alert">
          {error}
        </p>
      )}
      {libraryEmpty && !importing && (
        <div className="k-empty">
          <Library size={32} aria-hidden="true" />
          <h3>{query ? "Nothing to search yet" : "Your documents live here"}</h3>
          <p>
            Import a folder of PDFs, images or text notes. They are copied to
            the Pi, searchable offline, and Shackleton can cite them.
          </p>
          <button
            type="button"
            className="k-btn k-btn--primary"
            onClick={() => setImporting(true)}
          >
            <FolderInput size={16} aria-hidden="true" /> Import a folder
          </button>
        </div>
      )}
      {results && !libraryEmpty && !results.files.length && (
        <div className="k-empty">
          <SearchX size={32} aria-hidden="true" />
          <h3>
            {query
              ? `No documents match “${query}”`
              : "No documents in this filter"}
          </h3>
          <p>Try another word, or show every format and collection.</p>
          {filtered && (
            <button type="button" className="k-btn" onClick={clearSearch}>
              Clear search
            </button>
          )}
        </div>
      )}
      {!!results?.files.length && (
        <ul className={`document-gallery ${layout}`}>
          {results.files.map((file) => (
            <li key={file.id}>
              <button
                className="research-result-title"
                aria-label={title(file.name)}
                title={file.name}
                disabled={busy}
                onClick={() => void open(file)}
              >
                {layout !== "list" && (
                  <span className="document-cover" aria-hidden="true">
                    {file.mime === "application/pdf" ||
                    file.mime.startsWith("image/") ? (
                      <LocalImage
                        src={`/api/research/${file.id}/thumbnail`}
                        fallback={
                          <span className="text-cover">{title(file.name)}</span>
                        }
                      />
                    ) : (
                      <span className="text-cover">
                        {
                          file.name
                            .replace(/\.(txt|md)$/i, "")
                            .split(" - ")
                            .slice(-1)[0]
                        }
                      </span>
                    )}
                    <small>
                      {file.mime === "application/pdf"
                        ? "PDF"
                        : file.mime.startsWith("image/")
                          ? "IMAGE"
                          : "TEXT"}
                    </small>
                  </span>
                )}
                <strong>{title(file.name)}</strong>
              </button>
              <span className="document-meta">
                {file.collection}
                {file.page ? ` · PDF page ${file.page}` : ""}
                {file.searchable === false ? " · image only; OCR needed" : ""}
              </span>
              {query && file.snippet && (
                <p className="research-snippet">{file.snippet}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {results?.limited && (
        <p className="lib-note">
          Showing the first 100 results. Narrow your search to see more.
        </p>
      )}
      {preview && (
        <DocumentReader
          key={preview.url}
          source={preview}
          onClose={() => setPreview(null)}
          onAsk={(file) => {
            setPreview(null);
            onAsk(file);
          }}
        />
      )}
    </section>
  );
}
