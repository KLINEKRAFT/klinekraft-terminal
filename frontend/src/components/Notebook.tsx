import { useEffect, useState, type FormEvent } from "react";
import { isHostedDemo } from "../runtime";
import { ArticleDialog, localJSON } from "./WikiReader";
import type { Turn } from "./AssistantPanel";

type Entry = { id: number; project: string; note: string; turn: Turn };
type Source = Turn["sources"][number];

export function NotebookSave({ turn }: { turn: Turn }) {
  const [project, setProject] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      await localJSON("/api/notebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, note, turn }),
      });
      setStatus("Saved to notebook on the Pi.");
    } catch (failure) {
      setStatus((failure as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return <details>
    <summary>Save to notebook</summary>
    <form className="research-fields" onSubmit={save}>
      <label>Project <input value={project} maxLength={80} required
        onChange={(event) => setProject(event.target.value)} /></label>
      <label>Note <textarea value={note} maxLength={4000}
        onChange={(event) => setNote(event.target.value)} /></label>
      <button type="submit" disabled={saving || !project.trim()}>Save entry</button>
    </form>
    {status && <p role="status">{status}</p>}
  </details>;
}

export function Notebook() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [project, setProject] = useState("");
  const [error, setError] = useState("");
  const [wiki, setWiki] = useState<Source | null>(null);
  const [file, setFile] = useState<{ url: string; source: Source } | null>(null);

  useEffect(() => {
    if (isHostedDemo) return;
    const request = new AbortController();
    void localJSON("/api/notebook", { signal: request.signal }).then(setEntries)
      .catch((failure: Error) => {
        if (!request.signal.aborted) setError(failure.message);
      });
    return () => request.abort();
  }, []);

  useEffect(() => () => {
    if (file) URL.revokeObjectURL(file.url);
  }, [file]);

  async function open(source: Source) {
    if (!source.fileId) {
      setWiki(source);
      return;
    }
    try {
      const response = await fetch(`/api/research/${source.fileId}`, {
        headers: { "X-Klinekraft-Client": "local-ui" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Could not open the cited file.");
      setFile({ url: URL.createObjectURL(await response.blob()), source });
    } catch (failure) {
      setError((failure as Error).message);
    }
  }

  if (isHostedDemo) return null;
  return <section className="settings-panel research-library" aria-label="Project notebook">
    <h2>Project notebook</h2>
    {error && <p role="alert">{error}</p>}
    {entries.length ? <label>Project <select value={project} onChange={(event) => setProject(event.target.value)}>
      <option value="">All projects</option>
      {[...new Set(entries.map((entry) => entry.project))].sort().map((name) =>
        <option key={name}>{name}</option>)}
    </select></label> : <p>Save an assistant answer to start a project.</p>}
    {entries.filter((entry) => !project || entry.project === project).map((entry) =>
      <details key={entry.id}>
        <summary>{entry.turn.question} · {entry.project}</summary>
        {entry.note && <p>{entry.note}</p>}
        <p className="ai-answer">{entry.turn.answer}</p>
        {!!entry.turn.sources.length && <ul>{entry.turn.sources.map((source) =>
          <li key={source.id}><button onClick={() => void open(source)}>
            [{source.id}] {source.title}{source.page ? ` · page ${source.page}` : ""}
          </button></li>
        )}</ul>}
      </details>)}
    {file && <p><a href={file.url + (file.source.page ? `#page=${file.source.page}` : "")}
      target="_blank" rel="noopener noreferrer">Open {file.source.title}</a>
      {" "}<button onClick={() => setFile(null)}>Close citation</button></p>}
    {wiki && <ArticleDialog reference={wiki} onClose={() => setWiki(null)} />}
  </section>;
}
