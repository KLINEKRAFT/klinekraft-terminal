import { useState } from "react";
import { FlaskConical, Search, SearchX } from "lucide-react";
import { localJSON } from "./WikiReader";
import { SourceLink } from "./Briefing";
type Paper = {
  id: string;
  provider: string;
  title: string;
  year: string;
  url: string;
  abstract: string;
  stale: boolean;
  openAccess: boolean;
  pmcid?: string;
};
const example = "water purification";
export function ScienceSearch() {
  const [query, setQuery] = useState(""),
    [searched, setSearched] = useState(""),
    [papers, setPapers] = useState<Paper[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false),
    [saved, setSaved] = useState<string[]>([]);
  async function search(q = query) {
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const d = await localJSON(
        "/api/briefing/research?" + new URLSearchParams({ q }),
      );
      setPapers(d.results);
      setSearched(q);
      setMessage(
        d.sources
          .filter((s: { error?: string }) => s.error)
          .map(
            (s: { name: string }) =>
              `${s.name} unavailable; showing any saved results.`,
          )
          .join(" "),
      );
    } catch (e) {
      setFailed(true);
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(p: Paper, fullText = false) {
    setBusy(true);
    try {
      await localJSON("/api/briefing/research/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searched,
          id: p.id,
          provider: p.provider,
          fullText,
        }),
      });
      window.dispatchEvent(new Event("klinekraft:library-changed"));
      setSaved((v) => [...v, p.provider + p.id]);
      setMessage(
        "Saved to Library → Documents → Science research. Shackleton can search this saved reference.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="lib-research">
      <h2 className="sr-only">Research papers</h2>
      <form
        className="lib-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input
          className="k-field lib-toolbar-grow"
          type="search"
          aria-label="Search scientific research"
          placeholder="Search published papers"
          value={query}
          maxLength={200}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="k-btn k-btn--primary"
          disabled={busy || query.trim().length < 2}
        >
          <Search size={16} aria-hidden="true" />
          {busy ? "Searching…" : "Search"}
        </button>
      </form>
      {message && (
        <p role={failed ? "alert" : "status"} className={failed ? "lib-alert" : "lib-note"}>
          {message}
        </p>
      )}
      {!searched && !busy && !failed && (
        <div className="k-empty">
          <FlaskConical size={32} aria-hidden="true" />
          <h3>Search published research</h3>
          <p>
            Finds papers on OpenAlex and Europe PMC while you are online. Save
            one and it stays in Documents for offline reading, where Shackleton
            can cite it.
          </p>
          <button
            type="button"
            className="k-btn"
            onClick={() => {
              setQuery(example);
              void search(example);
            }}
          >
            Try “{example}”
          </button>
        </div>
      )}
      {searched && !busy && !papers.length && (
        <div className="k-empty">
          <SearchX size={32} aria-hidden="true" />
          <h3>No papers found for “{searched}”</h3>
          <p>Try broader words. Searching needs an internet connection.</p>
        </div>
      )}
      {papers.map((p) => (
        <article key={p.provider + p.id} className="lib-paper">
          <span className="k-eyebrow">
            {p.provider} · {p.year}
            {p.stale ? " · Last known" : ""}
            {p.openAccess ? " · Open access" : ""}
          </span>
          <h3>
            <SourceLink url={p.url}>{p.title}</SourceLink>
          </h3>
          <p>{p.abstract.replace(/<[^>]+>/g, "") || "Abstract unavailable."}</p>
          <div className="lib-actions">
            <button
              className="k-btn"
              disabled={busy || saved.includes(p.provider + p.id)}
              onClick={() => void save(p)}
            >
              {saved.includes(p.provider + p.id) ? "Saved" : "Save reference"}
            </button>
            {p.provider === "Europe PMC" && p.openAccess && p.pmcid && (
              <button
                className="k-btn k-btn--quiet"
                disabled={busy}
                onClick={() => void save(p, true)}
              >
                Save full text
              </button>
            )}
          </div>
        </article>
      ))}
      {!!papers.length && (
        <p className="lib-caption">
          Saving keeps the title, metadata and abstract. Research papers are
          not necessarily clinical or emergency guidance.
        </p>
      )}
    </section>
  );
}
