import { useConversations, downloadJSON } from "./useConversations";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Paperclip, Plus, SlidersHorizontal, X } from "lucide-react";
import { isHostedDemo } from "../runtime";
import {
  ArticleDialog,
  WikiImage,
  localJSON,
  type WikiReference,
} from "./WikiReader";
export type Turn = {
  question: string;
  attachmentName?: string | null;
  answer: string;
  notice: string;
  sources: (WikiReference & { id: number; fileId?: number | null; page?: number | null })[];
  images: {
    path: string;
    caption: string;
    articlePath: string;
    title: string;
    sourceId: number;
  }[];
};
const attachmentTypes = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

function encodeAttachment(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
    reader.onerror = () => reject(new Error("The attachment could not be read."));
    reader.readAsDataURL(file);
  });
}

export function AssistantPanel({
  context,
  onClearContext,
  initialAttachment,
  onConsumeAttachment,
}: {
  context: WikiReference | null;
  initialAttachment?: File | null;
  onConsumeAttachment?: () => void;
  onClearContext: () => void;
}) {
  const store = useConversations(context);
  const { turns, context: articleContext } = store.chat;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [rename, setRename] = useState("");
  useEffect(() => {
    onClearContext();
    onConsumeAttachment?.();
  }, []);
  const [status, setStatus] = useState<{
    configured: boolean;
    model: string;
  } | null>(null);
  const [question, setQuestion] = useState("");
  const [attachment, setAttachment] = useState<File | null>(initialAttachment ?? null);
  const [preview, setPreview] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!attachment) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(attachment);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment]);
  const [useResearch, setUseResearch] = useState(false);
  const [researchSource, setResearchSource] = useState<{ title: string; url: string; page?: number | null } | null>(null);
  useEffect(() => () => {
    if (researchSource) URL.revokeObjectURL(researchSource.url);
  }, [researchSource]);
  const [useWiki, setUseWiki] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<WikiReference | null>(null);
  const [revision, setRevision] = useState(0);
  const end = useRef<HTMLDivElement | null>(null);
  const input = useRef<HTMLTextAreaElement | null>(null);
  const [pending, setPending] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    if (isHostedDemo) return;
    const request = new AbortController();
    void localJSON("/api/ai/status", {
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)]),
    })
      .then((data) => {
        if (!request.signal.aborted) setStatus(data);
      })
      .catch((e) => {
        if (!request.signal.aborted) setError(e.message);
      });
    return () => request.abort();
  }, [revision]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [turns.length, busy]);
  const composerDisabled =
    busy || isHostedDemo || store.loading || store.saving || store.dirty ||
    turns.length >= 200;
  async function ask(e: FormEvent) {
    e.preventDefault();
    if (
      !question.trim() ||
      composerDisabled ||
      !status?.configured
    )
      return;
    const sent = question;
    const request = new AbortController();
    controller.current = request;
    setPending(sent);
    setQuestion("");
    setBusy(true);
    setError("");
    try {
      const upload = attachment && {
        mime: attachment.type,
        data: await encodeAttachment(attachment),
      };
      const data = await localJSON("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(120000)]),
        body: JSON.stringify({
          question: sent,
          attachment: upload,
          history: turns
            .flatMap((t) => [
              { role: "user", content: t.question },
              { role: "assistant", content: t.answer.slice(0, 4000) },
            ])
            .slice(-6),
          use_wiki: useWiki,
          use_research: useResearch,
          article_path: useWiki ? articleContext?.path : null,
        }),
      });
      if (request.signal.aborted) return;
      setAttachment(null);
      await store.update([...turns, { question: sent, attachmentName: attachment?.name, ...data }]);
      requestAnimationFrame(() => input.current?.focus());
    } catch (e) {
      if (!request.signal.aborted) {
        setQuestion(sent);
        setError(
          (e as Error).name === "TimeoutError"
            ? "The answer timed out. The provider may still have processed the request."
            : (e as Error).message,
        );
      }
    } finally {
      if (!request.signal.aborted) {
        setPending("");
        setBusy(false);
      }
    }
  }
  async function openResearchSource(source: Turn["sources"][number]) {
    setError("");
    try {
      const response = await fetch(`/api/research/${source.fileId}`, {
        headers: { "X-Klinekraft-Client": "local-ui" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Could not open this research source.");
      const url = URL.createObjectURL(await response.blob());
      setResearchSource({ title: source.title, url, page: source.page });
    } catch (failure) {
      setError((failure as Error).message);
    }
  }

  return (
    <section
      className="assistant-panel ai-chat"
      aria-label="Cloud AI assistant"
    >
      <div className="ai-chat-toolbar">
        <button
          className="ai-quiet-button"
          disabled={
            busy ||
            store.loading ||
            store.saving ||
            store.dirty ||
            (!turns.length && !articleContext)
          }
          onClick={() => {
            void store.update([]);
            onClearContext();
            setQuestion("");
            setAttachment(null);
            setError("");
            input.current?.focus();
          }}
        >
          <Plus size={15} /> New chat
        </button>
        <button
          className="ai-quiet-button"
          onClick={() => {
            setHistoryOpen((v) => !v);
            setRename(store.chat.title);
          }}
          aria-expanded={historyOpen}
        >
          History
        </button>
        <details className="ai-options">
          <summary aria-label="Chat settings">
            <SlidersHorizontal size={16} />
            <span>Settings</span>
          </summary>
          <div className="ai-options-content">
            <label>
              <input
                type="checkbox"
                checked={useWiki}
                onChange={(e) => setUseWiki(e.target.checked)}
                disabled={busy}
              />{" "}
              Use local Wikipedia
            </label>
            <p>OpenAI · {status?.model || "gpt-4.1-mini"}</p>
            <p>
              Questions, recent messages and relevant wiki excerpts go to
              OpenAI. Internet and API billing required.
            </p>
            <p>
              Chats are saved on this Pi. Only recent messages are sent with
              each question. Wikipedia stays available offline.
            </p>
          </div>
        </details>
      </div>
      {historyOpen && (
        <aside className="ai-history" aria-label="Saved conversations">
          <div className="ai-history-heading">
            <input
              aria-label="Search conversations"
              placeholder="Search conversations"
              value={store.query}
              onChange={(e) => store.setQuery(e.target.value)}
            />
            <button
              className="ai-quiet-button"
              onClick={() => setHistoryOpen(false)}
            >
              Close
            </button>
          </div>
          <div className="ai-history-list">
            {store.items.map((item) => (
              <button
                disabled={busy || store.saving || store.loading || store.dirty}
                aria-current={item.id === store.chat.id ? "true" : undefined}
                key={item.id}
                onClick={() => {
                  setAttachment(null);
                  void store.open(item.id);
                  setHistoryOpen(false);
                }}
              >
                {item.title}
                <small>{new Date(item.updated).toLocaleDateString()}</small>
              </button>
            ))}
            {!store.items.length && <p>No saved conversations found.</p>}
          </div>
          {store.chat.revision > 0 && (
            <form
              className="ai-rename"
              onSubmit={(e) => {
                e.preventDefault();
                if (rename.trim())
                  void store.save({ ...store.chat, title: rename.trim() });
              }}
            >
              <input
                aria-label="Conversation title"
                value={rename}
                maxLength={120}
                onChange={(e) => setRename(e.target.value)}
              />
              <button
                disabled={busy || store.saving || store.dirty || !rename.trim()}
              >
                Rename
              </button>
              <button
                type="button"
                disabled={busy || store.saving || store.dirty}
                onClick={() => void store.remove()}
              >
                Delete
              </button>
            </form>
          )}
          <div className="ai-history-heading">
            <button
              className="ai-quiet-button"
              onClick={() => void store.exportAll()}
            >
              Export all chats
            </button>
            <button className="ai-quiet-button" onClick={store.refresh}>
              Refresh
            </button>
          </div>
        </aside>
      )}
      {store.error && (
        <div role="alert" className="ai-save-error">
          {store.error}
          {store.dirty && (
            <div>
              <button
                disabled={store.saving}
                onClick={() => void store.retry()}
              >
                Retry save
              </button>
              <button disabled={store.saving} onClick={() => void store.copy()}>
                Save separate copy
              </button>
              <button
                onClick={() =>
                  downloadJSON(
                    { format: "klinekraft-chats-v1", chats: [store.chat] },
                    "klinekraft-unsaved-chat.json",
                  )
                }
              >
                Export this chat
              </button>
            </div>
          )}
        </div>
      )}
      {store.loading && <p role="status">Opening saved conversation…</p>}
      <div className="ai-chat-scroll" tabIndex={0} aria-label="Conversation">
        {isHostedDemo ? (
          <p className="ai-empty">Open the local Pi app to chat.</p>
        ) : status && !status.configured ? (
          <div className="ai-setup">
            <p>Connect your assistant.</p>
            <p className="ai-footnote">
              Run this on the Pi to enter your OpenAI API key privately.
            </p>
            <pre>python3 ~/klinekraft-terminal/scripts/setup-ai.py</pre>
            <button
              className="ai-quiet-button"
              onClick={() => {
                setError("");
                setRevision((r) => r + 1);
              }}
            >
              Check setup
            </button>
          </div>
        ) : !turns.length && !busy ? (
          <div className="ai-empty">
            <p>What would you like to explore?</p>
            <span>Ask anything. Bring your Wikipedia along.</span>
          </div>
        ) : null}
        <div className="ai-conversation">
          {turns.map((turn, i) => (
            <article className="ai-turn" key={i}>
              <h2 className="ai-user-message">{turn.question}</h2>
              {turn.attachmentName && <p className="ai-notice">Attachment: {turn.attachmentName}</p>}
              <div className="ai-answer">{turn.answer}</div>
              {turn.notice && <p className="ai-notice">{turn.notice}</p>}
              {!!turn.images.length && (
                <div className="ai-images">
                  {turn.images.map((img) => (
                    <div key={img.path}>
                      <WikiImage path={img.path} caption={img.caption} />
                      <button
                        onClick={() =>
                          setSelected({
                            path: img.articlePath,
                            title: img.title,
                          })
                        }
                      >
                        From {img.title} · image credits
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {!!turn.sources.length && (
                <details className="ai-source-details">
                  <summary>
                    {turn.sources.length === 1
                      ? "1 source"
                      : turn.sources.length + " sources"}
                  </summary>
                  <div className="ai-sources">
                    {turn.sources.map((s) => (
                      <button key={s.id} onClick={() => s.fileId ? void openResearchSource(s) : setSelected(s)}>
                        [{s.id}] {s.title}{s.page ? ` · page ${s.page}` : ""}
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </article>
          ))}
          {busy && (
            <article className="ai-turn">
              <h2 className="ai-user-message">{pending}</h2>
              <p className="ai-thinking" role="status">
                {useWiki ? "Reading and thinking…" : "Thinking…"}
              </p>
            </article>
          )}
          <div ref={end} />
        </div>
      </div>
      <div className="ai-compose-area">
        {turns.length >= 200 && (
          <p>
            This conversation has reached 200 answers. Start a new chat to
            continue; this one remains saved.
          </p>
        )}
        {error && (
          <p role="alert" className="browser-warning">
            {error}
          </p>
        )}
        <form className="ai-composer" onSubmit={ask}>
          <input
            type="file"
            ref={fileInput}
            accept={attachmentTypes.join(",")}
            hidden
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (!file) return;
              if (!attachmentTypes.includes(file.type) || !file.size ||
                  file.size > 8 * 1024 * 1024 || file.name.length > 255) {
                setError("Choose a PNG, JPEG, WebP or PDF up to 8 MiB with a filename of 255 characters or fewer.");
                return;
              }
              setAttachment(file);
              setError("");
            }}
          />
          {attachment && (
            <div className="ai-attachment">
              {preview && (!attachment.type.startsWith("image/") ? (
                <a href={preview} target="_blank" rel="noopener noreferrer">
                  Preview attachment
                </a>
              ) : (
                <img src={preview} alt="Attachment preview" />
              ))}
              <span>{attachment.name}</span>
              <button
                type="button"
                className="ai-quiet-button"
                disabled={busy}
                onClick={() => setAttachment(null)}
                aria-label="Remove attachment"
              >
                <X size={14} />
              </button>
              <p id="ai-upload-note" className="ai-notice">
                {attachment.type === "text/plain"
                  ? "Sending shares the first 32,000 bytes of this note with OpenAI. Chat history"
                  : "Sending uploads this file to OpenAI for this answer. Chat history"}
                {" "}saves the filename and answer on the Pi.
              </p>
            </div>
          )}
          {articleContext && (
            <div className="ai-context">
              <span>
                Article: {articleContext.title}
                {!useWiki && " · not included"}
              </span>
              <button
                type="button"
                disabled={busy || store.saving || store.dirty}
                onClick={() => {
                  store.clearContext();
                  onClearContext();
                }}
                aria-label="Remove article"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <label className="sr-only" htmlFor="ai-question">
            Your question
          </label>
          <textarea
            ref={input}
            id="ai-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            maxLength={3000}
            rows={2}
            placeholder="Message Klinekraft…"
            disabled={
              busy ||
              isHostedDemo ||
              store.loading ||
              store.saving ||
              store.dirty ||
              turns.length >= 200
            }
            aria-describedby={attachment ? "ai-keyboard-hint ai-upload-note" : "ai-keyboard-hint"}
          />
          {useResearch && <p className="ai-notice">Sending shares matching library excerpts with OpenAI.</p>}
          <div className="ai-compose-controls">
            <button className="ai-wiki-toggle" type="button" aria-pressed={useResearch}
              disabled={composerDisabled} onClick={() => setUseResearch((value) => !value)}>
              Research {useResearch ? "on" : "off"}
            </button>
            <button
              className="ai-quiet-button"
              type="button"
              aria-label="Attach image or PDF"
              title="Attach image or PDF"
              disabled={composerDisabled || !status?.configured}
              onClick={() => fileInput.current?.click()}
            >
              <Paperclip size={17} />
            </button>
            <button
              className="ai-wiki-toggle"
              type="button"
              aria-pressed={useWiki}
              disabled={busy}
              onClick={() => setUseWiki((v) => !v)}
            >
              Wikipedia {useWiki ? "on" : "off"}
            </button>
            <button
              className="ai-send"
              aria-label="Send message"
              title="Send message"
              disabled={
                busy ||
                store.loading ||
                store.saving ||
                store.dirty ||
                turns.length >= 200 ||
                !status?.configured ||
                !question.trim() ||
                isHostedDemo
              }
            >
              <ArrowUp size={18} />
            </button>
          </div>
        </form>
        <p id="ai-keyboard-hint" className="ai-chat-footer">
          {store.saving
            ? "Saving on Pi…"
            : store.dirty
              ? "Not saved yet"
              : store.chat.revision
                ? "Saved on Pi"
                : "Saves on Pi after your first answer"}{" "}
          · Enter to send. AI can make mistakes.
        </p>
      </div>
      {researchSource && (
        <section className="ai-context" aria-label="Research citation">
          <a href={researchSource.url + (researchSource.page ? `#page=${researchSource.page}` : "")}
            target="_blank" rel="noopener noreferrer">
            Open {researchSource.title}{researchSource.page ? ` · page ${researchSource.page}` : ""}
          </a>
          <button type="button" onClick={() => setResearchSource(null)} aria-label="Close research citation">
            <X size={14} />
          </button>
        </section>
      )}
      {selected && (
        <ArticleDialog reference={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}
