import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Globe,
  Maximize2,
  RotateCw,
  Search,
  SearchX,
  X,
} from "lucide-react";
import { isHostedDemo } from "../runtime";
export type WikiReference = { path: string; title: string };
type Article = WikiReference & {
  original: string | null;
  blocks: { kind: string; text: string }[];
  images: { path: string; caption: string }[];
  links: WikiReference[];
  truncated: boolean;
};
export async function localJSON(url: string, init: RequestInit = {}) {
  // The hosted web demo has no Pi service. Fail fast instead of sending
  // requests that can only 404 (and would leak noise into the console).
  if (isHostedDemo)
    throw Object.assign(Error("Available on the deck, not in the web demo."), {
      status: 0,
    });
  const response = await fetch(url, {
    ...init,
    headers: { ...init.headers, "X-Klinekraft-Client": "local-ui" },
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (typeof data?.detail === "string")
      throw Object.assign(Error(data.detail), { status: response.status });
    // FastAPI validation errors (422) send a list. They mean the input was
    // rejected, not that the service is down — say so instead of "restart".
    if (Array.isArray(data?.detail)) {
      const first = data.detail[0]?.msg;
      throw Error(
        typeof first === "string"
          ? `Not saved: ${first.replace(/^Value error, /, "")}`
          : "Not saved: check the size or format of what you entered.",
      );
    }
    throw Object.assign(
      Error("The local service is unavailable. Update or restart Klinekraft."),
      { status: response.status },
    );
  }
  return data;
}
export function WikiImage({
  path,
  caption,
}: {
  path: string;
  caption: string;
}) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let object = "";
    setUrl("");
    setFailed(false);
    void fetch(`/api/wiki/image?${new URLSearchParams({ path })}`, {
      headers: { "X-Klinekraft-Client": "local-ui" },
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const blob = await r.blob();
        if (!controller.signal.aborted) {
          object = URL.createObjectURL(blob);
          setUrl(object);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => {
      controller.abort();
      if (object) URL.revokeObjectURL(object);
    };
  }, [path]);
  return (
    <figure className="wiki-image">
      {url && !failed ? (
        <img
          src={url}
          alt={caption || "Image from Wikipedia article"}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="wiki-image-placeholder">
          {failed ? "Image unavailable in reading view" : "Loading image…"}
        </div>
      )}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
export function ArticleDialog({
  reference,
  onClose,
  onAsk,
}: {
  reference: WikiReference;
  onClose: () => void;
  onAsk?: (a: WikiReference) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(reference);
  const [article, setArticle] = useState<Article | null>(null);
  const [error, setError] = useState("");
  const [back, setBack] = useState<WikiReference[]>([]);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => {
      if (document.fullscreenElement === surface.current)
        void document.exitFullscreen().catch(() => {});
      element.close();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setArticle(null);
    setError("");
    void localJSON(
      `/api/wiki/article?${new URLSearchParams({ path: current.path })}`,
      {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(15000),
        ]),
      },
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setArticle(data);
          dialog.current?.scrollTo(0, 0);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [current]);
  async function fullscreen() {
    try {
      if (document.fullscreenElement === surface.current)
        await document.exitFullscreen();
      else await surface.current?.requestFullscreen();
    } catch {
      setError("Fullscreen is unavailable in this browser.");
    }
  }
  return (
    <dialog
      ref={dialog}
      className="knowledge-dialog"
      aria-label={
        current.path.startsWith("/content/wikipedia_")
          ? "Wikipedia article"
          : "Offline article"
      }
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div ref={surface} className="knowledge-surface">
        <header className="knowledge-toolbar">
          <span className="k-eyebrow">
            {current.path.startsWith("/content/wikipedia_")
              ? "WIKIPEDIA"
              : "KIWIX"}{" "}
            · READING VIEW
          </span>
          <div>
            {back.length > 0 && (
              <button
                className="k-btn k-btn--quiet"
                onClick={() => {
                  setCurrent(back.at(-1)!);
                  setBack(back.slice(0, -1));
                }}
              >
                Back
              </button>
            )}
            <button
              className="k-btn k-btn--quiet k-btn--icon"
              onClick={() => void fullscreen()}
              aria-label="Fullscreen article"
            >
              <Maximize2 size={16} aria-hidden="true" />
            </button>
            <button
              className="k-btn k-btn--quiet k-btn--icon"
              onClick={onClose}
              aria-label="Close article"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>
        <article className="wiki-article">
          <h2>{article?.title || current.title}</h2>
          {error && <p role="alert">{error}</p>}
          {!article && !error && <p role="status">Opening article…</p>}
          {article && (
            <>
              <div className="lib-actions">
                {onAsk && (
                  <button
                    className="k-btn k-btn--primary"
                    onClick={() => onAsk(article)}
                  >
                    Ask Shackleton
                  </button>
                )}
                <a
                  className="k-btn"
                  href={`http://127.0.0.1:8081${article.path}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Original layout <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              </div>
              {article.path.startsWith("/content/wikipedia_") ? (
                <p className="wiki-credit">
                  Wikipedia contributors ·{" "}
                  <a
                    href="https://en.wikipedia.org/wiki/Wikipedia:Copyrights"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Reuse and licensing
                  </a>
                  {article.original && (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={article.original}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Online original
                      </a>
                    </>
                  )}
                </p>
              ) : (
                <p className="wiki-credit">
                  Source credits and licensing are available in the original
                  layout.
                </p>
              )}
              {article.images[0] && <WikiImage {...article.images[0]} />}
              <div className="wiki-prose">
                {article.blocks.map((b, i) =>
                  b.kind === "h2" ? (
                    <h3 key={i}>{b.text}</h3>
                  ) : b.kind === "h3" ? (
                    <h4 key={i}>{b.text}</h4>
                  ) : (
                    <p
                      key={i}
                      className={b.kind === "li" ? "wiki-list-line" : undefined}
                    >
                      {b.text}
                    </p>
                  ),
                )}
              </div>
              {article.truncated && (
                <p>
                  Reading view is shortened. Open the original layout for the
                  full article.
                </p>
              )}
              {article.images.length > 1 && (
                <details className="content-details">
                  <summary>More article images</summary>
                  {article.images.slice(1).map((img) => (
                    <WikiImage key={img.path} {...img} />
                  ))}
                </details>
              )}
              <p className="wiki-credit">
                Images retain their original licenses. Use the original
                article’s image links for creator and license details.
              </p>
              {!!article.links.length && (
                <details className="content-details">
                  <summary>Related article links</summary>
                  <div className="wiki-related">
                    {article.links.map((link) => (
                      <button
                        key={link.path}
                        onClick={() => {
                          setBack([...back, current]);
                          setCurrent(link);
                        }}
                      >
                        {link.title}
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </article>
      </div>
    </dialog>
  );
}
type Book = { name: string; title: string; path: string };
type ReaderStatus = { ready: boolean; archives: string[] };
export function WikiBrowser({ onAsk }: { onAsk: (a: WikiReference) => void }) {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [book, setBook] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    (WikiReference & { snippet: string; bookTitle?: string })[]
  >([]);
  const [selected, setSelected] = useState<WikiReference | null>(null);
  const [error, setError] = useState("");
  // Set when the reader cannot list archives: says whether any are saved.
  const [offline, setOffline] = useState<ReaderStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (isHostedDemo) return;
    const controller = new AbortController();
    setError("");
    setOffline(null);
    setBooks(null);
    void localJSON("/api/wiki/books", {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        setBooks(data.books);
        setBook((current) =>
          data.books.some((b: Book) => b.name === current) ? current : "",
        );
        if (!data.books.length) setOffline({ ready: true, archives: [] });
      })
      .catch(async (e) => {
        if (controller.signal.aborted) return;
        // The reader is down. Ask the API whether archives are installed so
        // the setup message is accurate instead of a raw service error.
        try {
          const status = await localJSON("/api/wiki", {
            signal: controller.signal,
          });
          if (!controller.signal.aborted) {
            setBooks([]);
            setOffline(status);
          }
        } catch {
          if (!controller.signal.aborted) setError(e.message);
        }
      });
    return () => controller.abort();
  }, [revision]);
  async function search(e: FormEvent) {
    e.preventDefault();
    if (!query.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await localJSON(
        `/api/wiki/search?${new URLSearchParams({ q: query, book })}`,
        { signal: AbortSignal.timeout(20000) },
      );
      setResults(data.results);
      if (data.unavailable?.length)
        setError(
          `Some archives are unavailable: ${data.unavailable.join(", ")}.`,
        );
      setSearched(query.trim());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const ready = !!books?.length;
  return (
    <section className="lib-wiki" aria-label="Offline Wikipedia">
      <h2 className="sr-only">Wikipedia</h2>
      {isHostedDemo ? (
        <div className="k-empty">
          <Globe size={32} aria-hidden="true" />
          <h3>Wikipedia, offline</h3>
          <p>Offline Wikipedia runs in the local Pi app.</p>
        </div>
      ) : (
        <>
          {ready && (
            <form className="lib-toolbar" onSubmit={search}>
              <label className="sr-only" htmlFor="wiki-query">
                Search Wikipedia
              </label>
              <input
                id="wiki-query"
                className="k-field lib-toolbar-grow"
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  // Clearing the box goes back to browsing the archives.
                  if (!e.target.value.trim()) {
                    setResults([]);
                    setSearched("");
                  }
                }}
                placeholder="Find an article"
                maxLength={200}
              />
              {books.length > 1 && (
                <select
                  className="k-select"
                  aria-label="Archive"
                  value={book}
                  onChange={(e) => {
                    setBook(e.target.value);
                    setResults([]);
                    setSearched("");
                  }}
                >
                  <option value="">All archives</option>
                  {books.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.title}
                    </option>
                  ))}
                </select>
              )}
              <button
                className="k-btn k-btn--primary"
                disabled={busy || !query.trim()}
              >
                <Search size={16} aria-hidden="true" />
                {busy ? "Searching…" : "Search"}
              </button>
              <button
                type="button"
                className="k-btn k-btn--quiet k-btn--icon"
                aria-label="Refresh archives"
                title="Refresh archives"
                onClick={() => setRevision((r) => r + 1)}
              >
                <RotateCw size={16} aria-hidden="true" />
              </button>
            </form>
          )}
          {error && (
            <p role="alert" className="lib-alert">
              {error}
            </p>
          )}
          {!books && !error && (
            <p role="status" className="lib-note">
              Checking the offline reader…
            </p>
          )}
          {offline && (
            <div className="k-empty">
              <Globe size={32} aria-hidden="true" />
              {offline.archives.length ? (
                <>
                  <h3>Your archive is saved. The reader is not responding.</h3>
                  <p>
                    Start the offline reader from the Pi’s Terminal, then check
                    again.
                  </p>
                  <code>systemctl --user restart klinekraft-wiki.service</code>
                </>
              ) : (
                <>
                  <h3>Wikipedia, offline</h3>
                  <p>
                    Download a starter collection once, then search and read
                    articles anywhere, with no connection. Run this in the Pi’s
                    Terminal, then check again.
                  </p>
                  <code>bash scripts/setup-local-content.sh</code>
                </>
              )}
              <button
                type="button"
                className="k-btn"
                onClick={() => setRevision((r) => r + 1)}
              >
                <RotateCw size={16} aria-hidden="true" /> Check again
              </button>
            </div>
          )}
          {ready && !searched && !results.length && (
            <ul className="lib-archives" aria-label="Installed archives">
              {books.map((b) => (
                <li key={b.name}>
                  <button
                    type="button"
                    className="k-card"
                    aria-label={`Browse ${b.title}`}
                    onClick={() => setSelected({ path: b.path, title: b.title })}
                  >
                    <BookOpen size={20} aria-hidden="true" />
                    <strong>{b.title}</strong>
                    <span>Browse from the main page</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {searched && !busy && !results.length && (
            <div className="k-empty">
              <SearchX size={32} aria-hidden="true" />
              <h3>No articles match “{searched}”</h3>
              <p>
                {books && books.length > 1 && book
                  ? "Try a shorter topic, or search all archives."
                  : "Try a shorter or different topic."}
              </p>
            </div>
          )}
          {!!results.length && (
            <ul className="wiki-results">
              {results.map((r) => (
                <li key={r.path}>
                  <button onClick={() => setSelected(r)}>
                    {r.title}
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </button>
                  {r.bookTitle && <small>{r.bookTitle}</small>}
                  <p>{r.snippet}</p>
                </li>
              ))}
            </ul>
          )}
          {ready && (
            <p className="lib-caption">
              Reading view simplifies the original layout. Equations and
              complex tables may need the{" "}
              <a href="http://127.0.0.1:8081/" target="_blank" rel="noreferrer">
                original reader
              </a>
              .
            </p>
          )}
        </>
      )}
      {selected && (
        <ArticleDialog
          reference={selected}
          onClose={() => setSelected(null)}
          onAsk={(a) => {
            setSelected(null);
            onAsk(a);
          }}
        />
      )}
    </section>
  );
}
