import { setAudioFocus } from "../audioFocus";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, MicOff, Square } from "lucide-react";
import { localJSON } from "./WikiReader";
import { VoicePresence, type VoicePhase } from "./VoicePresence";
import { isHostedDemo } from "../runtime";

type Preferences = { enabled: boolean; style: "hologram" | "liquid"; online: boolean; followup: number };
type Status = { phase: VoicePhase; text: string; answer: string; error: string; level: number; installed: boolean;
  nativeOverlay: boolean; preferences: Preferences; recognition: string; chatId: string;
  event: { id: string; kind: "navigate" | "radio" | "context"; value: string } | null;
  timers: { id: string; seconds: number }[] };
let current: Status | null = null;
const listeners = new Set<() => void>();
let interval: ReturnType<typeof setInterval> | undefined, loading = false;
async function refresh() {
  if (loading || isHostedDemo) return;
  loading = true;
  try { current = await localJSON("/api/voice"); listeners.forEach(fn => fn()); }
  catch { if (current) { current = { ...current, phase: "error", error: "Voice service unavailable", event: null }; listeners.forEach(fn => fn()); } }
  finally { loading = false; }
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  if (!interval) { void refresh(); interval = setInterval(() => void refresh(), 250); }
  return () => { listeners.delete(fn); if (!listeners.size) { clearInterval(interval); interval = undefined; } };
}
function useVoice() { return useSyncExternalStore(subscribe, () => current); }
export async function voiceControl(action: "listen" | "stop" | "mute" | "unmute") {
  await localJSON("/api/voice/control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
  await refresh();
}
export function VoiceButton() {
  const status = useVoice(), [error, setError] = useState("");
  if (isHostedDemo || !status) return null;
  return <span className="voice-button-wrap"><button className="icon-button" aria-label={status.preferences.enabled ? "Mute Shackleton microphone" : "Enable Shackleton microphone"}
    title={status.preferences.enabled ? "Shackleton is listening for its name · click to mute" : "Shackleton microphone off · click to enable"}
    onClick={() => { setError(""); void voiceControl(status.preferences.enabled ? "mute" : "unmute").catch(e => setError(e.message)); }}>
    {status.preferences.enabled ? <Mic size={18} /> : <MicOff size={18} />}</button>{error && <small role="alert">{error}</small>}</span>;
}
export function VoiceCompanion({ onNavigate }: { onNavigate?: (page: string) => Promise<boolean> }) {
  const status = useVoice(), hud = useRef<HTMLDivElement>(null), seen = useRef(new Set<string>());
  const navigate = useRef(onNavigate); navigate.current = onNavigate;
  const active = !!status && !status.nativeOverlay && ["listening", "thinking", "preparing", "speaking", "followup", "error"].includes(status.phase);
  useEffect(() => {
    const element = hud.current;
    if (active && element && !element.matches(":popover-open")) element.showPopover();
    else if (!active && element?.matches(":popover-open")) element.hidePopover();
  }, [active]);
  useEffect(() => {
    const duck = !!status && ["listening", "thinking", "preparing", "speaking", "followup"].includes(status.phase);
    setAudioFocus("companion", duck);
    return () => { setAudioFocus("companion", false); };
  }, [status?.phase]);
  useEffect(() => {
    if (!onNavigate || isHostedDemo) return;
    const beat = () => { void localJSON("/api/voice/ack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "heartbeat", result: "" }) }).catch(() => {}); };
    beat(); const timer = setInterval(beat, 2000); return () => clearInterval(timer);
  }, [!!onNavigate]);
  useEffect(() => {
    const event = status?.event;
    if (!event || !navigate.current || seen.current.has(event.id)) return;
    seen.current.add(event.id);
    if (seen.current.size > 100) seen.current.delete(seen.current.values().next().value!);
    void (async () => {
      let result = "That control is unavailable.";
      if (event.kind === "navigate") result = await navigate.current!(event.value) ? `Opened ${event.value}.` : "Navigation was blocked to protect unsaved work.";
      if (event.kind === "context") {
        const detail = { text: "" };
        window.dispatchEvent(new CustomEvent("klinekraft-voice-context", { detail }));
        result = (window.getSelection()?.toString().trim() || detail.text || document.querySelector<HTMLElement>("main")?.innerText || "No readable page is open.").slice(0, 6000);
      }
      if (event.kind === "radio") result = await new Promise<string>(resolve => {
        const timer = setTimeout(() => resolve("Radio did not confirm playback."), 3500);
        window.dispatchEvent(new CustomEvent("klinekraft-voice-radio", { detail: { action: event.value, complete: (value: string) => { clearTimeout(timer); resolve(value); } } }));
      });
      await localJSON("/api/voice/ack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: event.id, result }) });
    })().catch(() => {});
  }, [status?.event?.id]);
  if (isHostedDemo) return null;
  return <div ref={hud} popover="manual" className="voice-hud" aria-label="Shackleton voice">
    {status && <><VoicePresence style={status.preferences.style} phase={status.phase} level={status.level} />
      <div className="voice-hud-text"><span className="voice-phase" role="status">{status.phase === "followup" ? "Anything else?" : status.phase === "preparing" ? "Preparing voice…" : status.phase}</span>
        <p>{status.error || status.text || "I'm listening…"}</p>
        {status.answer && <details><summary>Answer</summary><p>{status.answer}</p></details>}
      </div>
      <button className="icon-button" aria-label="Stop Shackleton" onClick={() => void voiceControl("stop").catch(() => {})}><Square size={17} /></button>
      <button className="icon-button" aria-label="Mute microphone" onClick={() => void voiceControl("mute").catch(() => {})}><MicOff size={17} /></button>
    </>}
  </div>;
}
export function VoiceCompanionSettings() {
  const status = useVoice(), [error, setError] = useState(""), [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<VoicePhase>("listening");
  async function save(patch: Partial<Preferences>) {
    if (!status || saving) return; setSaving(true); setError("");
    try { await localJSON("/api/voice/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...status.preferences, ...patch }) }); await refresh(); }
    catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  if (!status) return null;
  return <details className="voice-settings"><summary>Hands-free Shackleton</summary>
    <div className="voice-settings-body">
      <VoicePresence style={status.preferences.style} phase={preview} preview />
      <label>Appearance<select value={status.preferences.style} disabled={saving} onChange={e => void save({ style: e.target.value as Preferences["style"] })}><option value="hologram">Fine particle hologram</option><option value="liquid">Liquid core</option></select></label>
      <label>Animation preview<select value={preview} onChange={e => setPreview(e.target.value as VoicePhase)}><option value="listening">Listening</option><option value="thinking">Thinking</option><option value="speaking">Speaking</option><option value="muted">Muted</option></select></label>
      <label><input type="checkbox" checked={status.preferences.enabled} disabled={saving || !status.installed} onChange={e => void save({ enabled: e.target.checked })} />Listen locally for “Shackleton”</label>
      <label><input type="checkbox" checked={status.preferences.online} disabled={saving} onChange={e => void save({ online: e.target.checked })} />Use online services when available, with offline fallback</label>
      <label>Follow-up window<select value={status.preferences.followup} disabled={saving} onChange={e => void save({ followup: Number(e.target.value) })}><option value={0}>Off</option><option value={5}>5 seconds</option><option value={7}>7 seconds</option><option value={10}>10 seconds</option></select></label>
      <button className="k-btn" disabled={!status.preferences.enabled} onClick={() => void voiceControl("listen").catch(e => setError(e.message))}>Listen now</button>
      <small>Local wake detection. Say “Shackleton,” pause for the animation, then speak. “Shackleton, stop” interrupts. Text is saved in chat History; microphone audio is not saved. Online transcription requests zero retention and falls back locally if unsupported. Timers require the deck to stay on.</small>
      <small>{status.recognition}</small>
      {error && <p role="alert">{error}</p>}
    </div>
  </details>;
}
