import { DocumentReader, type DocumentSource } from "./DocumentReader";
import { useEffect, useState, type FormEvent } from "react";
import { isHostedDemo } from "../runtime";
import { ArticleDialog, localJSON } from "./WikiReader";
import { downloadJSON } from "./useConversations";
import type { Turn } from "./AssistantPanel";

type Entry = { id: number; revision: string; project: string; note: string; turn: Turn };
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

export function Notebook({ onAsk }: { onAsk: (file: File) => void }) {
  function ask(entry: Entry) {
    const citations = entry.turn.sources.map((source) =>
      `[${source.id}] ${source.title}${source.page ? `, page ${source.page}` : ""}`
    );
    const text = [
      `Project: ${entry.project}`,
      `Question: ${entry.turn.question}`,
      `Saved answer: ${entry.turn.answer}`,
      entry.note && `Note: ${entry.note}`,
      citations.length && ["Saved citations", ...citations].join("\n"),
    ].filter(Boolean).join("\n\n");
    onAsk(new File([text], "notebook-entry.txt", { type: "text/plain" }));
  }

  const [trash, setTrash] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [saving, setSaving] = useState(false);
  async function updateEntry(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      const updated = await localJSON(`/api/notebook/${editing.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: editing.project, note: editing.note, revision: editing.revision }),
      });
      setEntries((items) => items.map((item) => item.id === updated.id ? updated : item));
      setProject("");
      setEditing(null);
    } catch (failure) { setError((failure as Error).message); }
    finally { setSaving(false); }
  }
  async function moveEntry(entry: Entry) {
    setSaving(true);
    setError("");
    try {
      await localJSON(`/api/notebook/${entry.id}/trash?trash=${!trash}`, { method: "POST" });
      setEntries((items) => items.filter((item) => item.id !== entry.id));
      setProject("");
    } catch (failure) { setError((failure as Error).message); }
    finally { setSaving(false); }
  }

  const [query, setQuery] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [project, setProject] = useState("");
  const [error, setError] = useState("");
  const [wiki, setWiki] = useState<Source | null>(null);
  const [file, setFile] = useState<DocumentSource | null>(null);

  useEffect(() => {
    if (isHostedDemo) return;
    const request = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ q: query, trash: String(trash) });
    if (cursor !== null) params.set("before", String(cursor));
    void localJSON(`/api/notebook?${params}`, { signal: request.signal })
      .then((page: Entry[]) => {
        if (request.signal.aborted) return;
        setEntries((previous) => cursor === null ? page : [...previous, ...page]);
        setHasMore(page.length === 200);
      })
      .catch((failure: Error) => {
        if (!request.signal.aborted) setError(failure.message);
      }).finally(() => {
        if (!request.signal.aborted) setLoading(false);
      });
    return () => request.abort();
  }, [query, cursor, trash]);

  async function open(source: Source) {
    if (!source.fileId) {
      setWiki(source);
      return;
    }
    setFile({ url: `/api/research/${source.fileId}`, title: source.title, page: source.page });
  }

  if (isHostedDemo) return null;
  return <section className="settings-panel research-library" aria-label="Project notebook">
    <h2>Project notebook</h2>
    <button disabled={saving} onClick={() => {
      setTrash((value) => !value); setCursor(null); setEntries([]); setHasMore(false);
      setProject(""); setEditing(null);
    }}>{trash ? "Back to notebook" : "Trash"}</button>
    {editing && <form className="research-fields" onSubmit={updateEntry}>
      <label>Edit project <input required maxLength={80} value={editing.project}
        onChange={(event) => setEditing({ ...editing, project: event.target.value })} /></label>
      <label>Edit note <textarea maxLength={4000} value={editing.note}
        onChange={(event) => setEditing({ ...editing, note: event.target.value })} /></label>
      <button disabled={saving || !editing.project.trim()}>Save changes</button>
      <button type="button" disabled={saving} onClick={() => setEditing(null)}>Cancel</button>
    </form>}
    <label>Search notebook <input type="search" value={query} maxLength={200}
      onChange={(event) => {
        setQuery(event.target.value);
        setCursor(null);
        setProject("");
        setEntries([]);
      }} /></label>
    {!!entries.length && <button disabled={loading} onClick={() =>
      downloadJSON(entries.filter((entry) => !project || entry.project === project), "klinekraft-notebook.json")
    }>Export loaded entries</button>}
    {error && <p role="alert">{error}</p>}
    {entries.length ? <label>Project <select value={project} onChange={(event) => setProject(event.target.value)}>
      <option value="">All projects</option>
      {[...new Set(entries.map((entry) => entry.project))].sort().map((name) =>
        <option key={name}>{name}</option>)}
    </select></label> : <p>{loading ? "Loading notebook…" : query ? "No matching entries." : "Save an assistant answer to start a project."}</p>}
    {entries.filter((entry) => !project || entry.project === project).map((entry) =>
      <details key={entry.id}>
        <summary>{entry.turn.question} · {entry.project}</summary>
        {entry.note && <p>{entry.note}</p>}
        <p className="ai-answer">{entry.turn.answer}</p>
        <button disabled={saving} onClick={() => setEditing(entry)}>Edit note</button>
        <button disabled={saving} onClick={() => void moveEntry(entry)}>{trash ? "Restore" : "Move to trash"}</button>
        <button type="button" onClick={() => ask(entry)}>Ask about this entry</button>
        {!!entry.turn.sources.length && <ul>{entry.turn.sources.map((source) =>
          <li key={source.id}><button onClick={() => void open(source)}>
            [{source.id}] {source.title}{source.page ? ` · page ${source.page}` : ""}
          </button></li>
        )}</ul>}
      </details>)}
    {hasMore && !!entries.length && <button disabled={loading} onClick={() => setCursor(entries[entries.length - 1].id)}>
      {loading ? "Loading…" : "Load older entries"}
    </button>}
    {file && <DocumentReader key={file.url + ":" + file.page} source={file} onClose={() => setFile(null)} />}
    {wiki && <ArticleDialog reference={wiki} onClose={() => setWiki(null)} />}
  </section>;
}
