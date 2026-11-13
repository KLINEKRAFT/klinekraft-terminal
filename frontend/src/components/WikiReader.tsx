import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, X, Search, Maximize2 } from "lucide-react";
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
  const response = await fetch(url, {
    ...init,
    headers: { ...init.headers, "X-Klinekraft-Client": "local-ui" },
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw Error(
      typeof data?.detail === "string"
        ? data.detail
        : "The local service is unavailable. Update or restart Klinekraft.",
    );
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
      aria-label="Wikipedia article"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div ref={surface} className="knowledge-surface">
        <header className="knowledge-toolbar">
          <span className="eyebrow">WIKIPEDIA · READING VIEW</span>
          <div>
            {back.length > 0 && (
              <button
                onClick={() => {
                  setCurrent(back.at(-1)!);
                  setBack(back.slice(0, -1));
                }}
              >
                Back
              </button>
            )}
            <button
              onClick={() => void fullscreen()}
              aria-label="Fullscreen article"
            >
              <Maximize2 size={16} />
            </button>
            <button onClick={onClose} aria-label="Close article">
              <X size={18} />
            </button>
          </div>
        </header>
        <article className="wiki-article">
          <h2>{article?.title || current.title}</h2>
          {error && <p role="alert">{error}</p>}
          {!article && !error && <p role="status">Opening article…</p>}
          {article && (
            <>
              <div className="browser-actions">
                {onAsk && (
                  <button
                    className="browser-button"
                    onClick={() => onAsk(article)}
                  >
                    Ask AI about this
                  </button>
                )}
                <a
                  className="browser-button"
                  href={`http://127.0.0.1:8081${article.path}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Original layout <ArrowUpRight size={13} />
                </a>
              </div>
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
                    <a href={article.original} target="_blank" rel="noreferrer">
                      Online original
                    </a>
                  </>
                )}
              </p>
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
export function WikiBrowser({ onAsk }: { onAsk: (a: WikiReference) => void }) {
  const [books, setBooks] = useState<
    { name: string; title: string; path: string }[]
  >([]);
  const [book, setBook] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    (WikiReference & { snippet: string })[]
  >([]);
  const [selected, setSelected] = useState<WikiReference | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (isHostedDemo) return;
    const controller = new AbortController();
    setError("");
    void localJSON("/api/wiki/books", {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
    })
      .then((data) => {
        if (!controller.signal.aborted) {
          setBooks(data.books);
          setBook(data.books[0]?.name || "");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
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
      setSearched(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="browser-panel" aria-label="Offline Wikipedia">
      <h2>Wikipedia</h2>
      <p className="browser-help">
        Search your local archive. Read here, even offline.
      </p>
      {isHostedDemo ? (
        <p>Available in the local Pi app.</p>
      ) : (
        <>
          <form className="wiki-search" onSubmit={search}>
            <label className="sr-only" htmlFor="wiki-query">
              Search Wikipedia
            </label>
            <input
              id="wiki-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find an article"
              maxLength={200}
            />
            <button
              className="browser-button"
              disabled={busy || !book || !query.trim()}
            >
              <Search size={15} />
              {busy ? "Searching…" : "Search"}
            </button>
          </form>
          {books.length > 1 && (
            <label className="wiki-book">
              Archive
              <select
                value={book}
                onChange={(e) => {
                  setBook(e.target.value);
                  setResults([]);
                  setSearched(false);
                }}
              >
                {books.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {error && (
            <p role="alert" className="browser-warning">
              {error}
            </p>
          )}
          <div className="browser-actions">
            {books.find((b) => b.name === book) && (
              <button
                className="browser-button"
                onClick={() => {
                  const b = books.find((b) => b.name === book)!;
                  setSelected({ path: b.path, title: b.title });
                }}
              >
                Browse archive
              </button>
            )}
            <button
              className="browser-button"
              onClick={() => setRevision((r) => r + 1)}
            >
              Refresh reader
            </button>
          </div>
          {searched && !results.length && (
            <p className="browser-help">
              No matching articles in this archive. Try a shorter topic; the
              starter archive is only a small selection.
            </p>
          )}
          <ul className="wiki-results">
            {results.map((r) => (
              <li key={r.path}>
                <button onClick={() => setSelected(r)}>
                  {r.title}
                  <ArrowUpRight size={14} />
                </button>
                <p>{r.snippet}</p>
              </li>
            ))}
          </ul>
          <details className="content-details">
            <summary>About the archive</summary>
            <p>
              Reading view simplifies the original layout. Equations, complex
              tables and some image formats may need the original reader.
            </p>
            <a href="http://127.0.0.1:8081/" target="_blank" rel="noreferrer">
              Open Kiwix
            </a>
            {!books.length && (
              <pre>
                cd ~/klinekraft-terminal{"\n"}bash
                scripts/setup-local-content.sh
              </pre>
            )}
          </details>
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
