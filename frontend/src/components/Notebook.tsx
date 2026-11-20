import { DetailsPanel } from "./DetailsPanel";
import { DocumentReader, type DocumentSource } from "./DocumentReader";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Download, NotebookPen, SearchX, Trash2 } from "lucide-react";
import { isHostedDemo } from "../runtime";
import { ArticleDialog, localJSON } from "./WikiReader";
import { downloadJSON } from "./useConversations";
import type { Turn } from "./AssistantPanel";

type Entry = {
  id: number;
  revision: string;
  project: string;
  note: string;
  turn: Turn;
};
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

  return (
    <DetailsPanel title="Save to notebook">
      <form className="lib-form" onSubmit={save}>
        <label className="k-label">
          Project
          <input
            className="k-field"
            value={project}
            maxLength={80}
            required
            onChange={(event) => setProject(event.target.value)}
          />
        </label>
        <label className="k-label">
          Note
          <textarea
            className="k-field"
            value={note}
            maxLength={4000}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <div className="lib-actions">
          <button
            type="submit"
            className="k-btn k-btn--primary"
            disabled={saving || !project.trim()}
          >
            Save entry
          </button>
        </div>
      </form>
      {status && (
        <p role="status" className="lib-note">
          {status}
        </p>
      )}
    </DetailsPanel>
  );
}

export function Notebook({
  onAsk,
  onStart,
}: {
  onAsk: (file: File) => void;
  /** Opens Shackleton so the user can save a first answer. */
  onStart?: () => void;
}) {
  function ask(entry: Entry) {
    const citations = entry.turn.sources.map(
      (source) =>
        `[${source.id}] ${source.title}${source.page ? `, page ${source.page}` : ""}`,
    );
    const text = [
      `Project: ${entry.project}`,
      `Question: ${entry.turn.question}`,
      `Saved answer: ${entry.turn.answer}`,
      entry.note && `Note: ${entry.note}`,
      citations.length && ["Saved citations", ...citations].join("\n"),
    ]
      .filter(Boolean)
      .join("\n\n");
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
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: editing.project,
          note: editing.note,
          revision: editing.revision,
        }),
      });
      setEntries((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      setProject("");
      setEditing(null);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function moveEntry(entry: Entry) {
    setSaving(true);
    setError("");
    try {
      await localJSON(`/api/notebook/${entry.id}/trash?trash=${!trash}`, {
        method: "POST",
      });
      setEntries((items) => items.filter((item) => item.id !== entry.id));
      setProject("");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setSaving(false);
    }
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
        setEntries((previous) =>
          cursor === null ? page : [...previous, ...page],
        );
        setHasMore(page.length === 200);
      })
      .catch((failure: Error) => {
        if (!request.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!request.signal.aborted) setLoading(false);
      });
    return () => request.abort();
  }, [query, cursor, trash]);

  async function open(source: Source) {
    if (!source.fileId) {
      setWiki(source);
      return;
    }
    setFile({
      url: `/api/research/${source.fileId}`,
      title: source.title,
      page: source.page,
    });
  }

  if (isHostedDemo) return null;
  const projects = [...new Set(entries.map((entry) => entry.project))].sort();
  const visible = entries.filter(
    (entry) => !project || entry.project === project,
  );
  const searchable = !!entries.length || !!query;
  function toggleTrash() {
    setTrash((value) => !value);
    setCursor(null);
    setEntries([]);
    setHasMore(false);
    setProject("");
    setEditing(null);
  }
  return (
    <section className="lib-notebook" aria-label="Project notebook">
      <h2 className="sr-only">Project notebook</h2>
      <div className="lib-toolbar">
        {searchable && (
          <input
            className="k-field lib-toolbar-grow"
            type="search"
            aria-label="Search notebook"
            placeholder={trash ? "Search trash" : "Search saved answers"}
            value={query}
            maxLength={200}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(null);
              setProject("");
              setEntries([]);
            }}
          />
        )}
        {projects.length > 1 && (
          <select
            className="k-select"
            aria-label="Project"
            value={project}
            onChange={(event) => setProject(event.target.value)}
          >
            <option value="">All projects</option>
            {projects.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        )}
        {!!entries.length && (
          <button
            className="k-btn k-btn--quiet"
            disabled={loading}
            aria-label="Export loaded entries"
            onClick={() => downloadJSON(visible, "klinekraft-notebook.json")}
          >
            <Download size={16} aria-hidden="true" /> Export
          </button>
        )}
        <button
          className="k-btn k-btn--quiet lib-toolbar-end"
          disabled={saving}
          onClick={toggleTrash}
        >
          {trash ? (
            <>
              <ArrowLeft size={16} aria-hidden="true" /> Back to notebook
            </>
          ) : (
            <>
              <Trash2 size={16} aria-hidden="true" /> Trash
            </>
          )}
        </button>
      </div>
      {editing && (
        <form className="k-card lib-form" onSubmit={updateEntry}>
          <h3>Edit entry</h3>
          <label className="k-label">
            Edit project
            <input
              className="k-field"
              required
              maxLength={80}
              value={editing.project}
              onChange={(event) =>
                setEditing({ ...editing, project: event.target.value })
              }
            />
          </label>
          <label className="k-label">
            Edit note
            <textarea
              className="k-field"
              maxLength={4000}
              value={editing.note}
              onChange={(event) =>
                setEditing({ ...editing, note: event.target.value })
              }
            />
          </label>
          <div className="lib-actions">
            <button
              className="k-btn k-btn--primary"
              disabled={saving || !editing.project.trim()}
            >
              Save changes
            </button>
            <button
              type="button"
              className="k-btn k-btn--quiet"
              disabled={saving}
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="lib-alert">
          {error}
        </p>
      )}
      {!entries.length &&
        (loading ? (
          <p role="status" className="lib-note">
            Loading notebook…
          </p>
        ) : error ? null : query ? (
          <div className="k-empty">
            <SearchX size={32} aria-hidden="true" />
            <h3>No entries match “{query}”</h3>
            <p>Try another word from the question, answer or note.</p>
          </div>
        ) : trash ? (
          <div className="k-empty">
            <Trash2 size={32} aria-hidden="true" />
            <h3>Trash is empty</h3>
            <p>Entries you move to trash wait here until you restore them.</p>
          </div>
        ) : (
          <div className="k-empty">
            <NotebookPen size={32} aria-hidden="true" />
            <h3>Keep the answers worth keeping</h3>
            <p>
              When Shackleton answers, choose Save to notebook under the reply
              and file it under a project. Saved answers keep their sources.
            </p>
            {onStart ? (
              <button
                type="button"
                className="k-btn k-btn--primary"
                onClick={onStart}
              >
                Ask Shackleton
              </button>
            ) : (
              <code>Shackleton → answer → Save to notebook</code>
            )}
          </div>
        ))}
      {!!visible.length && (
        <ul className="lib-entries">
          {visible.map((entry) => (
            <li key={entry.id}>
              <details className="lib-entry">
                <summary>
                  <span className="lib-entry-question">
                    {entry.turn.question}
                  </span>
                  <span className="lib-chip">{entry.project}</span>
                </summary>
                <div className="lib-entry-body">
                  {entry.note && <p className="lib-entry-note">{entry.note}</p>}
                  <p className="ai-answer">{entry.turn.answer}</p>
                  {!!entry.turn.sources.length && (
                    <ul className="lib-sources" aria-label="Sources">
                      {entry.turn.sources.map((source) => (
                        <li key={source.id}>
                          <button
                            className="k-btn k-btn--quiet"
                            onClick={() => void open(source)}
                          >
                            [{source.id}] {source.title}
                            {source.page ? ` · page ${source.page}` : ""}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="lib-actions">
                    <button
                      type="button"
                      className="k-btn"
                      onClick={() => ask(entry)}
                    >
                      Ask about this entry
                    </button>
                    <button
                      className="k-btn k-btn--quiet"
                      disabled={saving}
                      onClick={() => setEditing(entry)}
                    >
                      Edit note
                    </button>
                    <button
                      className="k-btn k-btn--quiet"
                      disabled={saving}
                      onClick={() => void moveEntry(entry)}
                    >
                      {trash ? "Restore" : "Move to trash"}
                    </button>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      {hasMore && !!entries.length && (
        <button
          className="k-btn lib-more"
          disabled={loading}
          onClick={() => setCursor(entries[entries.length - 1].id)}
        >
          {loading ? "Loading…" : "Load older entries"}
        </button>
      )}
      {file && (
        <DocumentReader
          key={file.url + ":" + file.page}
          source={file}
          onClose={() => setFile(null)}
        />
      )}
      {wiki && <ArticleDialog reference={wiki} onClose={() => setWiki(null)} />}
    </section>
  );
}
