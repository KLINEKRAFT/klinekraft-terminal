import { useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { localJSON } from "./WikiReader";
type Recording = { id: string; title: string; created: number; provider: string };
export function Listen({ title, text, label = "Listen", prepare, className }: {
  title: string; text?: string; label?: string; prepare?: () => Promise<string>; className?: string;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className={className} onClick={() => setOpen(true)} title={label}>
      <Volume2 size={15} /> {label}
    </button>
    {open && <ListenDialog title={title} text={text} prepare={prepare} close={() => setOpen(false)} />}
  </>;
}
function ListenDialog({ title, text, prepare, close }: {
  title: string; text?: string; prepare?: () => Promise<string>; close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const request = useRef<AbortController | null>(null);
  const url = useRef("");
  const [passage, setPassage] = useState(text || "");
  const [provider, setProvider] = useState("local");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Recording[]>([]);
  const [saved, setSaved] = useState(false);
  const [playingTitle, setPlayingTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");
  useEffect(() => {
    let disposed = false;
    const previous = document.activeElement as HTMLElement | null;
    const output = audio.current;
    dialog.current?.showModal();
    void localJSON("/api/speech").then(s => { if (!disposed) { setProvider(s.provider); setReady(true); } })
      .catch(e => { if (!disposed) setError(e.message); });
    void localJSON("/api/speech/saved").then(s => { if (!disposed) setRows(s.recordings); })
      .catch(e => { if (!disposed) setError(e.message); });
    if (prepare) void prepare().then(value => { if (!disposed) setPassage(value); })
      .catch(e => { if (!disposed) setError(e.message); });
    return () => {
      disposed = true; request.current?.abort(); output?.pause();
      if (url.current) URL.revokeObjectURL(url.current);
      previous?.focus();
    };
  }, []);
  async function play(endpoint: string, name: string, body?: object) {
    request.current?.abort();
    audio.current?.pause();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError(""); setSaved(false);
    try {
      const response = await fetch(endpoint, {
        method: body ? "POST" : "GET",
        headers: { "X-Klinekraft-Client": "local-ui", "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(70000)]),
      });
      if (!response.ok) throw new Error((await response.json()).detail || "Audio unavailable.");
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(blob);
      if (audio.current) { audio.current.src = url.current; setPlayingTitle(name); }
      if (body && (body as {save?: boolean}).save) {
        setSaved(true);
        const result = await localJSON("/api/speech/saved");
        if (!controller.signal.aborted) setRows(result.recordings);
      }
      if (!controller.signal.aborted) await audio.current?.play();
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function remove(id: string) {
    try {
      await localJSON("/api/speech/saved/" + id, { method: "DELETE" });
      setRows(items => items.filter(item => item.id !== id)); setConfirmDelete("");
    } catch (e) { setError((e as Error).message); }
  }
  const valid = ready && passage.trim().length > 0 && passage.length <= 16000;
  return <dialog ref={dialog} className="listen-dialog" aria-label={title + " audio"} onCancel={e => { e.stopPropagation(); close(); }}>
    <header><h2>{title}</h2><button type="button" onClick={close}>Close</button></header>
    <label>Passage<textarea aria-label="Passage to read" value={passage} onChange={e => setPassage(e.target.value)} /></label>
    <div className="listen-actions">
      <label>Voice engine<select value={provider} onChange={e => setProvider(e.target.value)}>
        <option value="local">Offline · basic voice</option>
        <option value="elevenlabs">ElevenLabs · selected voice</option>
      </select></label>
      <button type="button" disabled={!valid || busy} onClick={() => void play("/api/speech", title, {text:passage,provider})}>Read aloud</button>
      <button type="button" disabled={!valid || busy} onClick={() => void play("/api/speech", title, {text:passage,provider,save:true,title:title.slice(0,200)})}>Read & save audio</button>
    </div>
    <small>{provider === "elevenlabs" ? "Sends this passage to ElevenLabs; uses internet and credits. Voice selection is in Settings → Speech." : "Generated on this Pi without internet."} {passage.length > 16000 && "Choose a shorter passage (16,000 characters maximum)."}</small>
    {busy && <p role="status">Preparing audio…</p>}
    {saved && <p role="status">Saved on this Pi for offline playback.</p>}
    {error && <p role="alert">{error}</p>}
    <p>{playingTitle}</p><audio ref={audio} controls aria-label="Recording playback" />
    <details><summary>Saved audio · {rows.length}</summary>
      {rows.length === 0 && <p>No saved recordings yet.</p>}
      {rows.map(row => <div className="saved-audio-row" key={row.id}>
        <button type="button" disabled={busy} onClick={() => void play("/api/speech/saved/" + row.id, row.title)}>
          {row.title}<small>{new Date(row.created * 1000).toLocaleString()} · {row.provider}</small>
        </button>
        <button type="button" onClick={() => confirmDelete === row.id ? void remove(row.id) : setConfirmDelete(row.id)}>
          {confirmDelete === row.id ? "Confirm delete" : "Delete"}
        </button>
      </div>)}
    </details>
  </dialog>;
}
