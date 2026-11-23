import { announceSpeech, setAudioFocus } from "../audioFocus";
import { VoiceCompanionSettings } from "./VoiceCompanion";
import { useEffect, useRef, useState } from "react";
import { Volume2, Square, Copy } from "lucide-react";
import { localJSON } from "./WikiReader";
type Settings = {
  configured: boolean;
  provider: "local" | "elevenlabs";
  voice: string;
  offline: boolean;
};
export function useReadAloud() {
  const [settings, setSettings] = useState<Settings>({
    configured: false,
    provider: "local",
    voice: "JBFqnCBsd6RMkjVDRZzb",
    offline: false,
  });
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<number | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const player = useRef<HTMLAudioElement | null>(null),
    request = useRef<AbortController | null>(null),
    cache = useRef<{ key: string; url: string } | null>(null);
  const seq = useRef(0);
  const owner = useRef(Symbol("read-aloud"));
  useEffect(() => {
    const other = (event: Event) => { if ((event as CustomEvent).detail !== owner.current) stop(); };
    window.addEventListener("klinekraft-speech-owner", other);
    return () => { window.removeEventListener("klinekraft-speech-owner", other); setAudioFocus(owner.current, false); };
  }, []);
  useEffect(() => {
    const c = new AbortController();
    const load = () => { void localJSON("/api/speech", { signal: c.signal })
      .then(value => { setSettings(value); setReady(true); })
      .catch(() => { if (!c.signal.aborted) setError("Voice settings unavailable. Try again shortly."); }); };
    load();
    window.addEventListener("speech-settings-updated", load);
    return () => {
      c.abort();
      window.removeEventListener("speech-settings-updated", load);
      seq.current++;
      request.current?.abort();
      player.current?.pause();
      if (cache.current) URL.revokeObjectURL(cache.current.url);
    };
  }, []);
  function stop() {
    setAudioFocus(owner.current, false);
    seq.current++;
    request.current?.abort();
    player.current?.pause();
    setActive(null);
    setLoading(false);
  }
  async function speak(text: string, index: number, onEnded?: () => void) {
    if (active === index) {
      stop();
      return;
    }
    stop();
    announceSpeech(owner.current);
    setAudioFocus(owner.current, true);
    setError("");
    setActive(index);
    setLoading(true);
    const version = seq.current,
      c = new AbortController();
    request.current = c;
    try {
      const key = JSON.stringify([text, settings.provider, settings.voice]);
      if (cache.current?.key !== key) {
        const response = await fetch("/api/speech", {
          method: "POST",
          headers: {
            "X-Klinekraft-Client": "local-ui",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text, provider: settings.provider }),
          signal: AbortSignal.any([c.signal, AbortSignal.timeout(70000)]),
        });
        if (!response.ok) {
          const e = await response.json();
          throw new Error(
            typeof e.detail === "string"
              ? e.detail
              : "Could not prepare speech.",
          );
        }
        const blob = await response.blob();
        if (c.signal.aborted || version !== seq.current) return;
        if (cache.current) URL.revokeObjectURL(cache.current.url);
        cache.current = { key, url: URL.createObjectURL(blob) };
      }
      if (version !== seq.current) return;
      const audio = new Audio(cache.current!.url);
      player.current = audio;
      audio.onended = () => {
        if (version === seq.current) { setAudioFocus(owner.current, false); setActive(null); onEnded?.(); }
      };
      audio.onerror = () => {
        if (version === seq.current) {
          setAudioFocus(owner.current, false);
          setError("Speech could not play.");
          setActive(null);
        }
      };
      await audio.play();
      if (version === seq.current) setLoading(false);
    } catch (e) {
      if (version === seq.current && !c.signal.aborted) {
        setAudioFocus(owner.current, false);
        setError((e as Error).message);
        setActive(null);
        setLoading(false);
      }
    }
  }
  return { settings, setSettings, ready, active, loading, error, stop, speak };
}
export type Reader = ReturnType<typeof useReadAloud>;
export function AnswerActions({
  text,
  index,
  reader,
}: {
  text: string;
  index: number;
  reader: Reader;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="answer-actions">
      <button
        type="button"
        aria-label={reader.active === index ? "Stop reading" : "Read aloud"}
        title={
          reader.settings.provider === "elevenlabs"
            ? "Read with ElevenLabs · sends this answer to ElevenLabs"
            : "Read aloud · offline voice"
        }
        onClick={() => void reader.speak(text, index)}
      >
        {reader.active === index ? <Square size={15} /> : <Volume2 size={15} />}
        <span>
          {reader.active === index
            ? reader.loading
              ? "Preparing…"
              : "Stop"
            : "Read aloud"}
        </span>
      </button>
      <button
        type="button"
        aria-label="Copy answer"
        onClick={() =>
          void navigator.clipboard
            .writeText(text)
            .then(() => setCopied(true))
            .catch(() => setCopied(false))
        }
      >
        <Copy size={15} />
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}
const VOICE_PRESETS = [
  { id: "WdZjiN0nNcik2LBjOHiv", label: "David · thoughtful British narrator" },
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George · warm storyteller" },
  { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel · steady broadcaster" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam · firm and confident" },
];
export function VoiceSettings({ reader }: { reader: Reader }) {
  const [key, setKey] = useState(""),
    [voice, setVoice] = useState(reader.settings.voice),
    [provider, setProvider] = useState(reader.settings.provider);
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setVoice(reader.settings.voice);
    setProvider(reader.settings.provider);
  }, [reader.settings]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const settings = await localJSON("/api/speech", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          voice,
          ...(key ? { apiKey: key } : {}),
        }),
      });
      reader.stop();
      reader.setSettings(settings);
      window.dispatchEvent(new Event("speech-settings-updated"));
      setKey("");
      setMessage("Voice settings saved.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="voice-settings">
      <summary>Read-aloud voice</summary>
      <form onSubmit={(e) => void save(e)}>
        <label>
          Speech engine
          <select
            aria-label="Speech engine"
            value={provider}
            onChange={(e) =>
              setProvider(e.target.value as Settings["provider"])
            }
          >
            <option value="local">Offline · basic voice</option>
            <option value="elevenlabs">ElevenLabs · natural voice</option>
          </select>
        </label>
        {provider === "elevenlabs" && (
          <>
            <p>
              Only the text you choose to read is
              sent to ElevenLabs. Internet and account credits are required.
            </p>
            <label>
              ElevenLabs API key
              <input
                type="password"
                value={key}
                autoComplete="off"
                placeholder={
                  reader.settings.configured
                    ? "Connected · leave blank to keep key"
                    : "Paste key privately here"
                }
                onChange={(e) => setKey(e.target.value)}
              />
            </label>
            <label>
              Voice
              <select
                aria-label="Voice"
                value={VOICE_PRESETS.some((preset) => preset.id === voice) ? voice : "custom"}
                onChange={(e) => setVoice(e.target.value === "custom" ? "" : e.target.value)}
              >
                {VOICE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
                <option value="custom">Custom voice…</option>
              </select>
            </label>
            {!VOICE_PRESETS.some((preset) => preset.id === voice) && (
              <label>
                Custom voice ID
                <input
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  maxLength={80}
                  pattern="[A-Za-z0-9_-]{1,80}"
                  required
                  spellCheck={false}
                />
              </label>
            )}
            <a
              href="https://elevenlabs.io/app/api/api-keys"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open ElevenLabs API keys
            </a>
          </>
        )}
        <button disabled={busy}>
          {busy ? "Connecting…" : "Save voice settings"}
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}


export function SpeechSettings() {
  const reader = useReadAloud();
  return <section className="settings-panel" aria-label="Speech">
    <h2>Speech</h2>
    <VoiceSettings reader={reader} />
    <VoiceCompanionSettings />
    {reader.error && <p role="alert">{reader.error}</p>}
  </section>;
}

export function DirectListen({ text, label = "Listen", className = "k-btn k-btn--quiet" }: {
  text: string; label?: string; className?: string;
}) {
  const reader = useReadAloud();
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    reader.stop();
    return () => { generation.current++; };
  }, [text]);
  function start() {
    if (reader.active !== null) { generation.current++; reader.stop(); return; }
    const version = ++generation.current;
    const chunks: string[] = [];
    let remaining = text.trim();
    while (remaining) {
      let end = Math.min(12000, remaining.length);
      if (end < remaining.length) {
        const space = remaining.lastIndexOf(" ", end);
        if (space > 6000) end = space;
      }
      chunks.push(remaining.slice(0,end)); remaining = remaining.slice(end).trim();
    }
    function next(index: number) {
      if (version !== generation.current || index >= chunks.length) return;
      void reader.speak(chunks[index], index, () => next(index + 1));
    }
    next(0);
  }
  return <span className="direct-listen">
    <button type="button" className={className} disabled={!reader.ready || !text.trim()}
      onClick={start} aria-label={reader.active !== null ? "Stop reading" : label}
      title={reader.settings.provider === "elevenlabs" ? "Play with your selected voice · ElevenLabs credits apply" : "Play with offline voice"}>
      {reader.active !== null ? <Square size={15} /> : <Volume2 size={15} />}
      {reader.active !== null ? reader.loading ? "Preparing…" : "Stop" : label}
    </button>
    {reader.error && <small role="alert">{reader.error}</small>}
  </span>;
}
