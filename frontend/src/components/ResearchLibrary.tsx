import { DetailsPanel } from "./DetailsPanel";
import { LocalImage } from "./LocalImage";
import { Info } from "./Info";
import { DocumentReader, type DocumentSource } from "./DocumentReader";
import { useEffect, useState, type FormEvent } from "react";
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

export function ResearchLibrary({
  onAsk,
  initialQuery = "",
}: {
  onAsk: (file: File) => void;
  initialQuery?: string;
}) {
  const [mime, setMime] = useState("");
  const [layout, setLayout] = useState("shelf");
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
  const [preview, setPreview] = useState<DocumentSource | null>(null);

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

  if (isHostedDemo) return null;
  return (
    <section
      className="settings-panel research-library"
      aria-label="Research library"
    >
      <div className="library-view-tools">
        <div className="view-switch">
          {["shelf", "grid", "list"].map((view) => (
            <button
              key={view}
              aria-pressed={layout === view}
              onClick={() => setLayout(view)}
            >
              {view}
            </button>
          ))}
        </div>
        <Info label="Library information">
          <p>
            Local documents. Select a cover to preview the PDF or read its text.
            Shelf view scrolls horizontally; use Grid to browse more at once.
          </p>
        </Info>
      </div>
      <DetailsPanel title="Import documents" className="library-import">
        <form onSubmit={importFolder}>
          <label>
            Collection{" "}
            <input
              value={collection}
              required
              maxLength={80}
              onChange={(event) => setCollection(event.target.value)}
            />
          </label>
          <label>
            Location{" "}
            <select
              value={root}
              onChange={(event) => setRoot(event.target.value)}
            >
              <option value="documents">Documents</option>
              <option value="downloads">Downloads</option>
            </select>
          </label>
          <label>
            Folder inside location{" "}
            <input
              value={path}
              required
              maxLength={1024}
              placeholder="e.g. Research/Physics"
              onChange={(event) => setPath(event.target.value)}
            />
          </label>
          <button disabled={busy || !collection.trim() || !path.trim()}>
            Import
          </button>
        </form>
        <p>
          PDFs, images and text notes up to 8 MiB. Imported files are copied to
          the Pi library.
        </p>
      </DetailsPanel>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <div className="library-search">
        <label>
          Search files{" "}
          <input
            type="search"
            value={query}
            maxLength={200}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <DetailsPanel title="Filters">
        <div className="research-fields">
          <label>
            Format
            <select
              aria-label="Document format"
              value={mime}
              onChange={(e) => setMime(e.target.value)}
            >
              <option value="">All</option>
              <option value="application/pdf">PDF</option>
              <option value="text/plain">Text</option>
            </select>
          </label>

          <label>
            Collection{" "}
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="">All collections</option>
              {results?.collections.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
        </div>
      </DetailsPanel>
      {results && !results.files.length && (
        <p>{query ? "No matching files." : "No files in this view."}</p>
      )}
      {!!results?.files.length && (
        <ul className={`document-gallery ${layout}`}>
          {results.files.map((file) => (
            <li key={file.id}>
              <button
                className="research-result-title"
                aria-label={file.name.replace(/\.(txt|pdf|md|html?)$/i, "")}
                title={file.name}
                disabled={busy}
                onClick={() => void open(file)}
              >
                {layout !== "list" && (
                  <span className="document-cover">
                    {file.mime === "application/pdf" ||
                    file.mime.startsWith("image/") ? (
                      <LocalImage
                        src={`/api/research/${file.id}/thumbnail`}
                        fallback={
                          <span className="text-cover">{file.name}</span>
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
                <strong>
                  {file.name.replace(/\.(txt|pdf|md|html?)$/i, "")}
                </strong>
              </button>
              <span>
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
        <p>Showing the first 100 results. Narrow your search to see more.</p>
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
