import {
  ChevronLeft,
  ChevronRight,
  History,
  NotebookPen,
  Plus,
  RotateCcw,
  SearchX,
  Trash2,
} from "lucide-react";
import { Info } from "./Info";
import { usHolidays } from "../holidays";
import { RichNote, noteText } from "./RichNote";
import { useEffect, useRef, useState } from "react";
import { localJSON } from "./WikiReader";
import { isHostedDemo } from "../runtime";

type Item = {
  id: string;
  kind: "note" | "event";
  title: string;
  body: string;
  day: string | null;
  time: string;
  revision: number;
  archived: boolean;
};
function dayString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function Organizer({
  kind,
  initialId,
  onConsumeInitialId,
}: {
  kind: Item["kind"];
  initialId?: string;
  onConsumeInitialId?: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const blank = (): Item => ({
    id: crypto.randomUUID(),
    kind,
    title: "",
    body: "",
    day: kind === "event" ? dayString(new Date()) : null,
    time: "",
    revision: 0,
    archived: false,
  });
  const [draft, setDraft] = useState<Item | null>(() => blank());
  const latest = useRef(draft);
  latest.current = draft;
  const [query, setQuery] = useState("");
  const [trash, setTrash] = useState(false);
  const [versions, setVersions] = useState<
    { revision: number; saved_at: string; item: Item }[] | null
  >(null);
  const historyRequest = useRef(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [saveError, setSaveError] = useState(false);
  // A 409 means the Pi copy changed elsewhere (another tab or device). Without
  // an explicit way out, every switch/New/Trash retries the same failing save.
  const [conflict, setConflict] = useState(false);
  const [status, setStatus] = useState("");
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [day, setDay] = useState(() => dayString(new Date()));
  const draftKey = `klinekraft.organizer.draft.${kind}`;
  const openedSearch = useRef<string | undefined>(undefined);
  const openLatest = useRef(open);
  openLatest.current = open;
  useEffect(() => {
    if (!initialId) {
      openedSearch.current = undefined;
      return;
    }
    if (openedSearch.current === initialId || saving.current) return;
    const found = items.find((item) => item.id === initialId && !item.archived);
    if (!found) return;
    openedSearch.current = initialId;
    setTrash(false);
    setQuery("");
    void openLatest.current(found);
    onConsumeInitialId?.();
  }, [initialId, items, busy]);
  useEffect(() => {
    const request = new AbortController();
    if (!isHostedDemo) {
      void localJSON(`/api/organizer?kind=${kind}`, { signal: request.signal })
        .then(setItems)
        .catch((error: Error) => {
          if (!request.signal.aborted) setStatus(error.message);
        });
    }
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const restored = JSON.parse(raw) as Item;
        if (
          restored.kind === kind &&
          typeof restored.title === "string" &&
          typeof restored.body === "string"
        ) {
          setDraft(restored);
          setDirty(true);
          setStatus("Recovered draft on this browser.");
        }
      }
    } catch {
      setStatus("Could not recover the browser draft.");
    }
    return () => request.abort();
  }, [kind, draftKey]);

  function edit(next: Item | null, changed = true) {
    setSaveError(false);
    setConflict(false);
    setStatus("");
    latest.current = next;
    setDraft(next);
    setDirty(!!next && changed);
    try {
      if (next && changed) localStorage.setItem(draftKey, JSON.stringify(next));
      else localStorage.removeItem(draftKey);
    } catch {
      setStatus("Draft recovery is unavailable. Save your changes on the Pi.");
    }
  }
  async function save(): Promise<boolean> {
    const snapshot = latest.current;
    if (!snapshot || saving.current) return false;
    const draft = {
      ...snapshot,
      title:
        snapshot.title.trim() ||
        (kind === "note"
          ? noteText(snapshot.body).trim().split("\n")[0].slice(0, 80)
          : ""),
    };
    if (!draft.title.trim() || (kind === "event" && !draft.day)) {
      setSaveError(true);
      setStatus(
        "Add a title" +
          (kind === "event" ? " and date" : "") +
          " before switching.",
      );
      return false;
    }
    saving.current = true;
    setSaveError(false);
    setBusy(true);
    setStatus("");
    try {
      const saved: Item = await localJSON(`/api/organizer/${draft.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      setItems((previous) => [
        saved,
        ...previous.filter((item) => item.id !== saved.id),
      ]);
      const current = latest.current;
      if (current?.id === saved.id) {
        const changed = current !== snapshot;
        const next = changed ? { ...current, revision: saved.revision } : saved;
        latest.current = next;
        setDraft(next);
        setDirty(changed);
        try {
          if (changed) localStorage.setItem(draftKey, JSON.stringify(next));
          else localStorage.removeItem(draftKey);
        } catch {
          /* Pi copy saved; recovery may be unavailable. */
        }
      }
      setStatus("Saved on Pi.");
      return current === snapshot;
    } catch (error) {
      setSaveError(true);
      setConflict((error as { status?: number }).status === 409);
      setStatus("Not saved — " + (error as Error).message);
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function keepMineAsCopy() {
    const mine = latest.current;
    if (!mine) return;
    setConflict(false);
    edit({
      ...mine,
      id: crypto.randomUUID(),
      revision: 0,
      title: `${mine.title.trim() || "Untitled"} (my copy)`,
    });
    await save();
  }
  async function loadPiVersion() {
    const mine = latest.current;
    if (!mine) return;
    try {
      const all: Item[] = await localJSON(`/api/organizer?kind=${kind}`);
      setItems(all);
      setConflict(false);
      edit(all.find((item) => item.id === mine.id) ?? blank(), false);
      setStatus("Loaded the version saved on the Pi.");
    } catch (error) {
      setSaveError(true);
      setStatus((error as Error).message);
    }
  }
  async function open(next: Item | null) {
    if (saving.current || next?.id === draft?.id) return;
    if (
      dirty &&
      draft &&
      !(
        draft.revision === 0 &&
        !draft.title.trim() &&
        !noteText(draft.body).trim()
      )
    ) {
      if (!(await save())) return;
    }
    historyRequest.current++;
    setVersions(null);
    edit(next, false);
  }
  async function archive(item: Item) {
    if (saving.current) return;
    if (dirty && latest.current && !(await save())) return;
    const current = latest.current?.id === item.id ? latest.current : item;
    saving.current = true;
    setBusy(true);
    try {
      const saved: Item = await localJSON(`/api/organizer/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...current, archived: !current.archived }),
      });
      setItems((all) => all.map((old) => (old.id === saved.id ? saved : old)));
      if (latest.current?.id === saved.id) {
        // Typing can continue while the request is in flight: never discard it.
        if (latest.current === current) edit(blank(), false);
        else
          edit({
            ...latest.current,
            revision: saved.revision,
            archived: saved.archived,
          });
        historyRequest.current++;
        setVersions(null);
      }
      setStatus(saved.archived ? "Moved to Trash." : "Restored.");
    } catch (error) {
      setSaveError(true);
      setStatus("Not saved — " + (error as Error).message);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function showHistory() {
    if (!draft || saving.current) return;
    if (versions) {
      setVersions(null);
      return;
    }
    const id = draft.id;
    const request = ++historyRequest.current;
    try {
      const rows = await localJSON(`/api/organizer/${id}/history`);
      if (latest.current?.id === id && request === historyRequest.current)
        setVersions(rows);
    } catch (error) {
      setSaveError(true);
      setStatus((error as Error).message);
    }
  }
  async function restoreVersion(item: Item) {
    if (!latest.current || saving.current) return;
    if (dirty && !(await save())) return;
    const current = latest.current!;
    if (current.id !== item.id) return;
    edit({
      ...current,
      title: item.title,
      body: item.body,
      day: item.day,
      time: item.time,
    });
    if (await save()) setVersions(null);
  }
  useEffect(() => {
    if (
      saveError ||
      !dirty ||
      busy ||
      !draft ||
      (!draft.title.trim() &&
        (kind === "event" || !noteText(draft.body).trim())) ||
      (kind === "event" && !draft.day)
    )
      return;
    const timer = window.setTimeout(() => {
      void save();
    }, 1600);
    return () => clearTimeout(timer);
  }, [draft, dirty, busy, saveError]);
  const visible = items
    .filter(
      (item) =>
        item.archived === trash &&
        (item.title + " " + item.body)
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (kind === "note" || !!query || item.day === day),
    )
    .sort((a, b) =>
      kind === "event"
        ? ((a.day ?? "") + a.time).localeCompare((b.day ?? "") + b.time)
        : 0,
    );
  const holidays = {
    ...usHolidays(month.getFullYear() - 1),
    ...usHolidays(month.getFullYear()),
    ...usHolidays(month.getFullYear() + 1),
  };
  const calendarDays = Array.from(
    { length: 42 },
    (_, index) =>
      new Date(
        month.getFullYear(),
        month.getMonth(),
        1 - month.getDay() + index,
      ),
  );
  const noun = kind === "note" ? "note" : "event";
  const friendlyDay = (value: string, weekday: "long" | "short" = "long") =>
    new Date(`${value}T12:00`).toLocaleDateString("en-US", {
      weekday,
      month: weekday,
      day: "numeric",
    });
  const friendlyTime = (value: string) =>
    value
      ? new Date(`2000-01-01T${value}`).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })
      : "All day";
  const today = dayString(new Date());
  // One quiet line in the editor's corner says where the words are.
  const saveState: { text: string; tone: "ok" | "warn" | "off" | "" } = busy
    ? { text: "Saving…", tone: "warn" }
    : saveError
      ? {
          text: conflict ? "Not saved — changed elsewhere" : status,
          tone: "off",
        }
      : dirty
        ? { text: "Edited", tone: "warn" }
        : status
          ? {
              text: status.replace(/\.$/, ""),
              // A failed list load also lands in status: never show it green.
              tone: /^(Saved|Moved|Restored|Loaded)\b/.test(status)
                ? "ok"
                : "off",
            }
          : draft && draft.revision > 0
            ? { text: "Saved on Pi", tone: "ok" }
            : { text: "", tone: "" };
  const emptyList = () => {
    if (kind === "event" && !query)
      return <p className="organizer-hint">Nothing scheduled.</p>;
    if (query)
      return (
        <div className="k-empty">
          <SearchX size={28} aria-hidden="true" />
          <h3>No matches</h3>
          <p>
            Nothing {trash ? "in Trash" : `in your ${noun}s`} mentions “{query}”.
          </p>
        </div>
      );
    if (trash)
      return (
        <div className="k-empty">
          <Trash2 size={28} aria-hidden="true" />
          <h3>Trash is empty</h3>
          <p>Removed {noun}s wait here until you restore them.</p>
        </div>
      );
    return (
      <div className="k-empty">
        <NotebookPen size={28} aria-hidden="true" />
        <h3>No notes yet</h3>
        <p>Start typing on the right. Notes save to the Pi as you write.</p>
      </div>
    );
  };
  if (isHostedDemo)
    return (
      <p>
        Open the local Pi app to use {kind === "note" ? "Notes" : "Calendar"}.
      </p>
    );
  return (
    <section
      className={`organizer organizer--${kind}`}
      aria-label={kind === "note" ? "Notes workspace" : "Calendar workspace"}
    >
      {kind === "event" && (
        <div className="calendar">
          <div className="calendar-head">
            <h2>
              {month.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <Info label="Calendar information">
              <p>
                US federal holidays, observed dates and common observances.
                Local device time. State, local and religious calendars vary.
              </p>
              <a
                href="https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/"
                target="_blank"
                rel="noreferrer"
              >
                Federal holiday source
              </a>
            </Info>
            <button
              type="button"
              className="k-btn"
              onClick={() => {
                const now = new Date();
                setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                setDay(dayString(now));
              }}
            >
              Today
            </button>
            <button
              type="button"
              className="k-btn k-btn--icon"
              aria-label="Previous month"
              title="Previous month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="k-btn k-btn--icon"
              aria-label="Next month"
              title="Next month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="calendar-grid">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
              <span key={label}>{label}</span>
            ))}
            {calendarDays.map((date) => {
              const key = dayString(date);
              const count = items.filter(
                (item) => !item.archived && item.day === key,
              ).length;
              return (
                <button
                  type="button"
                  key={key}
                  aria-label={`${key}${count ? `, ${count} events` : ""}`}
                  aria-pressed={day === key}
                  aria-current={key === today ? "date" : undefined}
                  className={
                    date.getMonth() === month.getMonth() ? "" : "other-month"
                  }
                  onClick={() => {
                    setDay(key);
                    setQuery("");
                  }}
                >
                  <span className="calendar-date">{date.getDate()}</span>
                  {holidays[key]?.map((name) => (
                    <small className="holiday" key={name} title={name}>
                      {name}
                    </small>
                  ))}
                  {count > 0 && (
                    <small className="calendar-count">
                      {count} event{count === 1 ? "" : "s"}
                    </small>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="organizer-columns">
        <aside className="organizer-list">
          <div className="organizer-list-head">
            {kind === "event" && (
              <div className="organizer-day">
                <h3>{query ? "All dates" : friendlyDay(day)}</h3>
                {!query && holidays[day] && (
                  <p className="holiday-agenda">{holidays[day].join(" · ")}</p>
                )}
              </div>
            )}
            <button
              type="button"
              className="k-btn k-btn--primary organizer-new"
              disabled={busy}
              onClick={() =>
                void open({
                  id: crypto.randomUUID(),
                  kind,
                  title: "",
                  body: "",
                  day: kind === "event" ? day : null,
                  time: "",
                  revision: 0,
                  archived: false,
                })
              }
            >
              <Plus size={18} aria-hidden="true" />
              {kind === "note" ? "New note" : "New event"}
            </button>
            <label className="sr-only" htmlFor={`organizer-search-${kind}`}>
              Search {noun}s
            </label>
            <input
              id={`organizer-search-${kind}`}
              className="k-field organizer-search"
              type="search"
              placeholder={`Search ${noun}s`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div
              className="organizer-filter"
              role="group"
              aria-label={`Show ${noun}s`}
            >
              <button
                type="button"
                className="k-btn"
                aria-pressed={!trash}
                onClick={() => setTrash(false)}
              >
                All
              </button>
              <button
                type="button"
                className="k-btn"
                aria-pressed={trash}
                onClick={() => setTrash(true)}
              >
                Trash
              </button>
            </div>
          </div>
          <div className="organizer-items">
            {!visible.length && emptyList()}
            {visible.map((item) => (
              <div className="organizer-row" key={item.id}>
                <button
                  type="button"
                  className="organizer-item"
                  disabled={busy}
                  aria-pressed={draft?.id === item.id}
                  onClick={() => void open(item)}
                >
                  <strong>{item.title}</strong>
                  <span>
                    {kind === "event"
                      ? `${query || item.day !== day ? `${friendlyDay(item.day ?? day, "short")} · ` : ""}${friendlyTime(item.time)}`
                      : noteText(item.body).slice(0, 100) || "Empty note"}
                  </span>
                </button>
                <button
                  type="button"
                  className="k-btn k-btn--quiet k-btn--icon note-trash"
                  disabled={busy}
                  aria-label={`${item.archived ? "Restore" : "Trash"} ${item.title}`}
                  title={item.archived ? "Restore from Trash" : "Move to Trash"}
                  onClick={() => void archive(item)}
                >
                  {item.archived ? (
                    <RotateCcw size={16} />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </div>
            ))}
          </div>
        </aside>
        <div className="organizer-editor">
          {draft ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <div className="organizer-head">
                <label className="organizer-title">
                  <span className="sr-only">Title</span>
                  <input
                    placeholder={kind === "note" ? "Title" : "Event title"}
                    required
                    maxLength={200}
                    value={draft.title}
                    onChange={(event) =>
                      edit({ ...draft, title: event.target.value })
                    }
                  />
                </label>
                <div className="organizer-savebar">
                  <p
                    className="save-state"
                    role="status"
                    data-tone={saveState.tone || undefined}
                  >
                    {saveState.tone && (
                      <span
                        className="k-status-dot"
                        data-state={saveState.tone}
                        aria-hidden="true"
                      />
                    )}
                    {saveState.text}
                  </p>
                  {conflict ? (
                    <>
                      <button
                        type="button"
                        className="k-btn"
                        disabled={busy}
                        onClick={() => void keepMineAsCopy()}
                      >
                        Keep mine as a copy
                      </button>
                      <button
                        type="button"
                        className="k-btn"
                        disabled={busy}
                        onClick={() => void loadPiVersion()}
                      >
                        Load Pi version
                      </button>
                    </>
                  ) : (
                    saveError &&
                    dirty && (
                      <button
                        type="submit"
                        className="k-btn"
                        disabled={
                          busy ||
                          (!draft.title.trim() && !noteText(draft.body).trim())
                        }
                      >
                        Try again
                      </button>
                    )
                  )}
                  {draft.revision > 0 && (
                    <button
                      type="button"
                      className="k-btn k-btn--quiet"
                      disabled={busy}
                      onClick={() => void showHistory()}
                      aria-expanded={versions !== null}
                      title="Saved versions"
                    >
                      <History size={16} aria-hidden="true" /> History
                    </button>
                  )}
                </div>
              </div>
              {versions !== null && (
                <section className="note-history" aria-label="Saved versions">
                  <h3 className="k-eyebrow">Saved versions</h3>
                  {!versions.length && <p>No earlier saved versions yet.</p>}
                  {versions.map((version) => (
                    <details key={version.revision}>
                      <summary>
                        Version {version.revision} · backed up{" "}
                        {new Date(version.saved_at).toLocaleString()}
                      </summary>
                      <strong>{version.item.title}</strong>
                      <p className="note-history-preview">
                        {noteText(version.item.body) || "Empty note"}
                      </p>
                      <button
                        type="button"
                        className="k-btn"
                        disabled={busy}
                        onClick={() => void restoreVersion(version.item)}
                      >
                        Restore this version
                      </button>
                    </details>
                  ))}
                </section>
              )}
              {kind === "event" && (
                <div className="event-when">
                  <label className="k-label">
                    Date
                    <input
                      className="k-field"
                      type="date"
                      required
                      value={draft.day ?? ""}
                      onChange={(event) =>
                        edit({ ...draft, day: event.target.value })
                      }
                    />
                  </label>
                  <label className="k-label">
                    Time (optional)
                    <input
                      className="k-field"
                      type="time"
                      value={draft.time}
                      onChange={(event) =>
                        edit({ ...draft, time: event.target.value })
                      }
                    />
                  </label>
                </div>
              )}
              {kind === "note" ? (
                <RichNote
                  key={draft.id}
                  value={draft.body}
                  onChange={(body) => edit({ ...latest.current!, body })}
                />
              ) : (
                <label className="k-label event-details">
                  Details
                  <textarea
                    className="k-field"
                    value={draft.body}
                    maxLength={100000}
                    placeholder="Where, who, what to bring"
                    onChange={(event) =>
                      edit({ ...latest.current!, body: event.target.value })
                    }
                  />
                </label>
              )}
            </form>
          ) : (
            <div className="k-empty">
              <NotebookPen size={28} aria-hidden="true" />
              <h3>Nothing open</h3>
              <p>Pick a {noun} on the left or start a new one.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
