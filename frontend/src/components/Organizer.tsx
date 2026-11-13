import { useEffect, useState } from "react";
import { localJSON } from "./WikiReader";
import { isHostedDemo } from "../runtime";

type Item = {
  id: string; kind: "note" | "event"; title: string; body: string;
  day: string | null; time: string; revision: number; archived: boolean;
};
function dayString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function Organizer({ kind }: { kind: Item["kind"] }) {
  const [items, setItems] = useState<Item[]>([]);
  const [draft, setDraft] = useState<Item | null>(null);
  const [query, setQuery] = useState("");
  const [trash, setTrash] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [day, setDay] = useState(() => dayString(new Date()));
  const draftKey = `klinekraft.organizer.draft.${kind}`;
  useEffect(() => {
    const request = new AbortController();
    if (!isHostedDemo) {
      void localJSON(`/api/organizer?kind=${kind}`, { signal: request.signal })
        .then(setItems).catch((error: Error) => {
          if (!request.signal.aborted) setStatus(error.message);
        });
    }
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const restored = JSON.parse(raw) as Item;
        if (restored.kind === kind && typeof restored.title === "string" && typeof restored.body === "string") {
          setDraft(restored);
          setStatus("Recovered draft on this browser.");
        }
      }
    } catch { setStatus("Could not recover the browser draft."); }
    return () => request.abort();
  }, [kind, draftKey]);

  function edit(next: Item | null) {
    setDraft(next);
    try {
      if (next) localStorage.setItem(draftKey, JSON.stringify(next));
      else localStorage.removeItem(draftKey);
    } catch { setStatus("Draft recovery is unavailable. Save your changes on the Pi."); }
  }
  async function save() {
    if (!draft) return;
    setBusy(true);
    setStatus("");
    try {
      const saved: Item = await localJSON(`/api/organizer/${draft.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft),
      });
      setItems((previous) => [saved, ...previous.filter((item) => item.id !== saved.id)]);
      edit(null);
      setStatus("Saved on Pi.");
    } catch (error) { setStatus((error as Error).message); }
    finally { setBusy(false); }
  }
  const visible = items.filter((item) => item.archived === trash &&
    (item.title + " " + item.body).toLowerCase().includes(query.toLowerCase()) &&
    (kind === "note" || !!query || item.day === day))
    .sort((a, b) => kind === "event" ? ((a.day ?? "") + a.time).localeCompare((b.day ?? "") + b.time) : 0);
  const calendarDays = Array.from({ length: 42 }, (_, index) =>
    new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay() + index));
  if (isHostedDemo) return <p>Open the local Pi app to use {kind === "note" ? "Notes" : "Calendar"}.</p>;
  return <section className="organizer" aria-label={kind === "note" ? "Notes workspace" : "Calendar workspace"}>
    {kind === "event" && <div className="calendar">
      <div className="organizer-toolbar">
        <button aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button>
        <h2>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
        <button aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button>
        <button onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setDay(dayString(now)); }}>Today</button>
      </div>
      <div className="calendar-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => <span key={label}>{label}</span>)}
        {calendarDays.map((date) => {
          const key = dayString(date);
          const count = items.filter((item) => !item.archived && item.day === key).length;
          return <button key={key} aria-label={`${key}${count ? `, ${count} events` : ""}`}
            aria-pressed={day === key} className={date.getMonth() === month.getMonth() ? "" : "other-month"}
            onClick={() => { setDay(key); setQuery(""); }}>
            {date.getDate()}{count > 0 && <small>{count} event{count === 1 ? "" : "s"}</small>}
          </button>;
        })}
      </div>
      <p className="organizer-caption">Events use local device time. Saved on this Pi.</p>
    </div>}
    <div className="organizer-columns">
      <aside className="organizer-list">
        <div className="organizer-toolbar">
          <button disabled={!!draft || busy} onClick={() => edit({
            id: crypto.randomUUID(), kind, title: "", body: "", day: kind === "event" ? day : null,
            time: "", revision: 0, archived: false,
          })}>New {kind === "note" ? "note" : "event"}</button>
          <button aria-pressed={trash} onClick={() => setTrash((value) => !value)}>{trash ? "Show active" : "Trash"}</button>
        </div>
        <label className="sr-only" htmlFor="organizer-search">Search {kind === "note" ? "notes" : "events"}</label>
        <input id="organizer-search" type="search" placeholder="Search…" value={query} onChange={(event) => setQuery(event.target.value)} />
        {!visible.length && <p>{kind === "event" && !query ? `No events for ${day}.` : "No items in this view."}</p>}
        {visible.map((item) => <button className="organizer-item" key={item.id} disabled={!!draft || busy} onClick={() => edit(item)}>
          <strong>{item.title}</strong>
          <span>{kind === "event" ? `${item.day} · ${item.time || "All day"}` : item.body.slice(0, 100) || "Empty note"}</span>
        </button>)}
      </aside>
      <div className="organizer-editor">
        {status && <p role="status">{status}</p>}
        {draft ? <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <label>Title<input required maxLength={200} value={draft.title} disabled={busy}
            onChange={(event) => edit({ ...draft, title: event.target.value })} /></label>
          {kind === "event" && <div className="organizer-toolbar">
            <label>Date<input type="date" required value={draft.day ?? ""} disabled={busy}
              onChange={(event) => edit({ ...draft, day: event.target.value })} /></label>
            <label>Time (optional)<input type="time" value={draft.time} disabled={busy}
              onChange={(event) => edit({ ...draft, time: event.target.value })} /></label>
          </div>}
          <label>{kind === "note" ? "Note" : "Details"}<textarea value={draft.body} maxLength={100000} disabled={busy}
            onChange={(event) => edit({ ...draft, body: event.target.value })} /></label>
          <div className="organizer-toolbar">
            <button type="submit" disabled={busy || !draft.title.trim()}>{busy ? "Saving…" : "Save on Pi"}</button>
            <button type="button" disabled={busy} onClick={() => edit(null)}>Close without saving</button>
            {draft.revision > 0 && <label><input type="checkbox" checked={draft.archived} disabled={busy}
              onChange={(event) => edit({ ...draft, archived: event.target.checked })} /> In trash</label>}
          </div>
        </form> : <div className="organizer-empty"><p>{kind === "note" ? "A place for your ideas." : "Plan your day."}</p><span>Select an item or create one to get started.</span></div>}
      </div>
    </div>
  </section>;
}
