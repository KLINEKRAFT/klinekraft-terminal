import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { matchSections, sectionLabel, type Section } from "../preview";
import { isHostedDemo } from "../runtime";
import { localJSON, type WikiReference } from "./WikiReader";
import { noteText } from "./RichNote";
import { emergencyGuides } from "../emergencyGuides";
import type { DocumentSource } from "./DocumentReader";
import type { MapLocation } from "./MapCollections";
export type SearchResult = {
  id: string;
  title: string;
  group: string;
  snippet?: string;
  section?: Section;
  noteId?: string;
  document?: DocumentSource;
  place?: MapLocation;
  wiki?: WikiReference;
  emergencyTopic?: string;
};
type Note = { id: string; title: string; body: string; archived: boolean };
type Research = {
  id: number;
  name: string;
  mime: string;
  snippet?: string;
  page?: number;
};
const appResult = (s: Section): SearchResult => ({
  id: `app:${s}`,
  title: sectionLabel(s),
  group: "Apps",
  section: s,
});
export function UniversalSearch({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (result: SearchResult) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const cache = useRef(new Map<string, unknown>());
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    dialog.current
      ?.querySelector<HTMLInputElement>('input[type="search"]')
      ?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    const request = new AbortController();
    const q = query.trim().toLocaleLowerCase();
    // Apps match by name or everyday alias ("calc", "radar", "wifi", "sos").
    const apps: SearchResult[] = matchSections(q).map(appResult);
    // Bundled field guides are always local and instant — never wait on the
    // network or the service to find "water" or "bleeding" in an emergency.
    if (q.length >= 2)
      for (const [topic, guide] of Object.entries(emergencyGuides)) {
        const step = guide.steps.find((text) =>
          text.toLocaleLowerCase().includes(q),
        );
        if (
          step ||
          `${topic} ${guide.title}`.toLocaleLowerCase().includes(q)
        )
          apps.push({
            id: `emergency:${topic}`,
            title: guide.title,
            group: "Emergency guide",
            section: "Emergency",
            snippet: step ?? guide.steps[0],
            emergencyTopic: topic,
          });
      }
    setResults(apps);
    setStatus("");
    if (q.length < 2 || isHostedDemo) {
      setBusy(false);
      if (isHostedDemo && q)
        setStatus("Local content search is available on the deck.");
      return () => request.abort();
    }
    setBusy(true);
    const timer = window.setTimeout(() => {
      async function localSource(path: string) {
        if (cache.current.has(path)) return cache.current.get(path);
        const data = await localJSON(path, { signal: request.signal });
        if (!request.signal.aborted) cache.current.set(path, data);
        return data;
      }
      const requests = [
        localSource("/api/organizer?kind=note"),
        localJSON(`/api/research?q=${encodeURIComponent(q)}`, {
          signal: request.signal,
        }),
        localSource("/api/maps/places"),
        localSource("/api/maps/catalog"),
        localJSON(`/api/wiki/search?q=${encodeURIComponent(q)}`, {
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
        }),
      ];
      const sources: Array<PromiseSettledResult<unknown> | undefined> = Array(
        requests.length,
      ).fill(undefined);
      function showResults() {
        if (request.signal.aborted) return;
        const found: SearchResult[] = [...apps];
        const notes = sources[0];
        if (notes?.status === "fulfilled")
          (notes.value as Note[])
            .filter((n) => !n.archived)
            .forEach((n) => {
              const plain = noteText(n.body);
              if (`${n.title} ${plain}`.toLocaleLowerCase().includes(q)) {
                const at = Math.max(
                  0,
                  plain.toLocaleLowerCase().indexOf(q) - 35,
                );
                found.push({
                  id: `note:${n.id}`,
                  title: n.title,
                  group: "Notes",
                  snippet: plain.slice(at, at + 150),
                  noteId: n.id,
                });
              }
            });
        const wiki = sources[4];
        const wikiData =
          wiki?.status === "fulfilled"
            ? (wiki.value as {
                results: (WikiReference & {
                  snippet: string;
                  bookTitle?: string;
                })[];
                unavailable?: string[];
              })
            : null;
        wikiData?.results.forEach((article) =>
          found.push({
            id: `wiki:${article.path}`,
            title: article.title,
            group: `Kiwix · ${article.bookTitle || "Offline archive"}`,
            snippet: article.snippet,
            wiki: article,
          }),
        );
        const library = sources[1];
        if (library?.status === "fulfilled")
          (library.value as { files: Research[] }).files.forEach((f) =>
            found.push({
              id: `document:${f.id}`,
              title: f.name,
              group: "Library",
              snippet: f.snippet,
              document: {
                url: `/api/research/${f.id}`,
                title: f.name,
                mime: f.mime,
                page: f.page,
              },
            }),
          );
        for (const i of [2, 3]) {
          const source = sources[i];
          if (source?.status !== "fulfilled") continue;
          const places: MapLocation[] =
            i === 2
              ? (source.value as MapLocation[])
              : (source.value as { places: MapLocation[] }).places;
          places
            .filter((p) =>
              `${p.name} ${p.note || ""}`.toLocaleLowerCase().includes(q),
            )
            .forEach((p, index) =>
              found.push({
                id: `place:${i}:${p.id || index}`,
                title: p.name,
                group: i === 2 ? "Saved places" : "Map collections",
                snippet: p.note,
                place: p,
              }),
            );
        }
        setResults(found.slice(0, 80));
        const unavailable = sources
          .map((s, i) =>
            s?.status === "rejected"
              ? [
                  "Notes",
                  "Library",
                  "Saved places",
                  "Map collections",
                  "Kiwix",
                ][i]
              : "",
          )
          .filter(Boolean);
        unavailable.push(
          ...(wikiData?.unavailable || []).map((name) => `Kiwix · ${name}`),
        );
        setStatus(
          unavailable.length
            ? `Unavailable: ${unavailable.join(", ")}. Other results are shown.`
            : found.length > 80
              ? "Showing the first 80 matches. Refine your search."
              : "",
        );
        setBusy(sources.some((source) => source === undefined));
      }
      requests.forEach((promise, index) => {
        void promise
          .then(
            (value) => {
              sources[index] = { status: "fulfilled", value };
            },
            (reason) => {
              sources[index] = { status: "rejected", reason };
            },
          )
          .then(showResults);
      });
    }, 220);
    return () => {
      clearTimeout(timer);
      request.abort();
    };
  }, [query]);
  return (
    <dialog
      className="universal-search"
      ref={dialog}
      aria-labelledby="universal-search-title"
      onCancel={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header>
        <h2 id="universal-search-title">Search Terminal</h2>
        <button
          className="icon-button"
          aria-label="Close search"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <label className="universal-search-input">
        <Search size={18} />
        <input
          type="search"
          aria-label="Search Terminal"
          placeholder="Apps, notes, library, Wikipedia, places…"
          maxLength={200}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              dialog.current
                ?.querySelector<HTMLButtonElement>(".universal-result")
                ?.focus();
            }
            if (event.key === "Enter") {
              // Apps always lead the list; recompute them so a fast
              // type-and-Enter never opens a match for the previous query.
              const app = matchSections(query)[0];
              const top = app
                ? appResult(app)
                : results[0]?.group === "Apps"
                  ? undefined
                  : results[0];
              if (!top) return;
              event.preventDefault();
              onSelect(top);
            }
          }}
        />
      </label>
      <div
        className="universal-results"
        aria-busy={busy}
        onKeyDown={(e) => {
          if (!["ArrowDown", "ArrowUp"].includes(e.key)) return;
          const buttons = Array.from(
            e.currentTarget.querySelectorAll("button"),
          );
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          e.preventDefault();
          buttons[
            (index + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) %
              buttons.length
          ]?.focus();
        }}
      >
        {results.map((result) => (
          <button
            key={result.id}
            className="universal-result"
            onClick={() => onSelect(result)}
          >
            <span>{result.group}</span>
            <strong>{result.title}</strong>
            {result.snippet && <small>{result.snippet}</small>}
          </button>
        ))}
        {!busy && !results.length && <p>No matches.</p>}
      </div>
      <footer role="status">
        {busy
          ? "Searching local content…"
          : status ||
            (query.trim().length < 2
              ? "Type at least two characters to search local content."
              : `${results.length} results · stored on this deck`)}
      </footer>
    </dialog>
  );
}
