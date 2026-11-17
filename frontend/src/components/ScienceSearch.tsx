import { useState } from "react";
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
export function ScienceSearch() {
  const [query, setQuery] = useState(""),
    [searched, setSearched] = useState(""),
    [papers, setPapers] = useState<Paper[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [saved, setSaved] = useState<string[]>([]);
  async function search() {
    setBusy(true);
    setMessage("");
    try {
      const d = await localJSON(
        "/api/briefing/research?" + new URLSearchParams({ q: query }),
      );
      setPapers(d.results);
      setSearched(query);
      setMessage(
        d.sources
          .filter((s: any) => s.error)
          .map((s: any) => `${s.name} unavailable; showing any saved results.`)
          .join(" ") || (!d.results.length ? "No results." : ""),
      );
    } catch (e) {
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
    <section className="science-search">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input
          aria-label="Search scientific research"
          placeholder="Search papers and research…"
          value={query}
          maxLength={200}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button disabled={busy || query.trim().length < 2}>Search</button>
      </form>
      <p className="briefing-caption">
        OpenAlex + Europe PMC · Online search; saved references work offline.
        Research papers are not necessarily clinical or emergency guidance.
      </p>
      {message && <p role="status">{message}</p>}
      {papers.map((p) => (
        <article key={p.provider + p.id}>
          <small>
            {p.provider} · {p.year} {p.stale ? "· LAST KNOWN" : ""}
          </small>
          <h3>
            <SourceLink url={p.url}>{p.title}</SourceLink>
          </h3>
          <p>{p.abstract.replace(/<[^>]+>/g, "") || "Abstract unavailable."}</p>
          <button
            disabled={busy || saved.includes(p.provider + p.id)}
            onClick={() => void save(p)}
          >
            {saved.includes(p.provider + p.id) ? "Saved" : "Save reference"}
          </button>
          {p.provider === "Europe PMC" && p.openAccess && p.pmcid && (
            <button disabled={busy} onClick={() => void save(p, true)}>
              Save full text
            </button>
          )}
          <small>
            {" "}
            Metadata + abstract{p.openAccess ? " · open-access source" : ""}
          </small>
        </article>
      ))}
    </section>
  );
}
