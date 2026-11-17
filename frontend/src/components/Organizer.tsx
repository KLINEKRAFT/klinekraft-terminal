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
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [saveError, setSaveError] = useState(false);
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
      setStatus("Not saved — " + (error as Error).message);
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
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
    edit(next, false);
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
  if (isHostedDemo)
    return (
      <p>
        Open the local Pi app to use {kind === "note" ? "Notes" : "Calendar"}.
      </p>
    );
  return (
    <section
      className="organizer"
      aria-label={kind === "note" ? "Notes workspace" : "Calendar workspace"}
    >
      {kind === "event" && (
        <div className="calendar">
          <div className="organizer-toolbar">
            <button
              aria-label="Previous month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              ←
            </button>
            <h2>
              {month.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <button
              aria-label="Next month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              →
            </button>
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
              onClick={() => {
                const now = new Date();
                setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                setDay(dayString(now));
              }}
            >
              Today
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
                  key={key}
                  aria-label={`${key}${count ? `, ${count} events` : ""}`}
                  aria-pressed={day === key}
                  className={
                    date.getMonth() === month.getMonth() ? "" : "other-month"
                  }
                  onClick={() => {
                    setDay(key);
                    setQuery("");
                  }}
                >
                  {date.getDate()}
                  {holidays[key]?.map((name) => (
                    <small className="holiday" key={name} title={name}>
                      {name}
                    </small>
                  ))}
                  {count > 0 && (
                    <small>
                      {count} event{count === 1 ? "" : "s"}
                    </small>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {kind === "event" && holidays[day] && (
        <div className="holiday-agenda">{holidays[day].join(" · ")}</div>
      )}
      <div className="organizer-columns">
        <aside className="organizer-list">
          <div className="organizer-toolbar">
            <button
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
              aria-label={kind === "note" ? "New note" : "New event"}
            >
              +
            </button>
            <button
              aria-pressed={trash}
              onClick={() => setTrash((value) => !value)}
            >
              {trash ? "Show active" : "Trash"}
            </button>
          </div>
          <label className="sr-only" htmlFor="organizer-search">
            Search {kind === "note" ? "notes" : "events"}
          </label>
          <input
            id="organizer-search"
            type="search"
            placeholder="Search…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {!visible.length && (
            <p>
              {kind === "event" && !query
                ? `No events for ${day}.`
                : "No items in this view."}
            </p>
          )}
          {visible.map((item) => (
            <button
              className="organizer-item"
              key={item.id}
              disabled={busy}
              aria-pressed={draft?.id === item.id}
              onClick={() => void open(item)}
            >
              <strong>{item.title}</strong>
              <span>
                {kind === "event"
                  ? `${item.day} · ${item.time || "All day"}`
                  : noteText(item.body).slice(0, 100) || "Empty note"}
              </span>
            </button>
          ))}
        </aside>
        <div className="organizer-editor">
          <p className="save-state" role="status">
            {busy
              ? "Saving…"
              : saveError
                ? status
                : dirty
                  ? "Edited"
                  : status
                    ? "Saved"
                    : ""}
          </p>
          {draft ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <label>
                <span className="sr-only">Title</span>
                <input
                  placeholder="Title"
                  required
                  maxLength={200}
                  value={draft.title}
                  onChange={(event) =>
                    edit({ ...draft, title: event.target.value })
                  }
                />
              </label>
              {kind === "event" && (
                <div className="organizer-toolbar">
                  <label>
                    Date
                    <input
                      type="date"
                      required
                      value={draft.day ?? ""}
                      onChange={(event) =>
                        edit({ ...draft, day: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Time (optional)
                    <input
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
                <label>
                  Details
                  <textarea
                    value={draft.body}
                    maxLength={100000}
                    onChange={(event) =>
                      edit({ ...latest.current!, body: event.target.value })
                    }
                  />
                </label>
              )}
              <div className="organizer-toolbar">
                <button
                  type="submit"
                  disabled={
                    busy ||
                    (!draft.title.trim() && !noteText(draft.body).trim())
                  }
                >
                  {busy ? "Saving…" : "Save on Pi"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void open(blank())}
                >
                  New
                </button>
                {draft.revision > 0 && (
                  <label>
                    <input
                      type="checkbox"
                      checked={draft.archived}
                      disabled={busy}
                      onChange={(event) =>
                        edit({ ...draft, archived: event.target.checked })
                      }
                    />{" "}
                    In trash
                  </label>
                )}
              </div>
            </form>
          ) : (
            <button onClick={() => edit(blank(), false)} aria-label="New note">
              +
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
