import { useConversations, downloadJSON } from "./useConversations";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Plus, SlidersHorizontal, X } from "lucide-react";
import { isHostedDemo } from "../runtime";
import {
  ArticleDialog,
  WikiImage,
  localJSON,
  type WikiReference,
} from "./WikiReader";
export type Turn = {
  question: string;
  answer: string;
  notice: string;
  sources: (WikiReference & { id: number })[];
  images: {
    path: string;
    caption: string;
    articlePath: string;
    title: string;
    sourceId: number;
  }[];
};
export function AssistantPanel({
  context,
  onClearContext,
}: {
  context: WikiReference | null;
  onClearContext: () => void;
}) {
  const store = useConversations(context);
  const { turns, context: articleContext } = store.chat;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [rename, setRename] = useState("");
  useEffect(() => {
    onClearContext();
  }, []);
  const [status, setStatus] = useState<{
    configured: boolean;
    model: string;
  } | null>(null);
  const [question, setQuestion] = useState("");
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
  async function ask(e: FormEvent) {
    e.preventDefault();
    if (
      !question.trim() ||
      busy ||
      !status?.configured ||
      isHostedDemo ||
      store.loading ||
      store.saving ||
      store.dirty ||
      turns.length >= 200
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
      const data = await localJSON("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(120000)]),
        body: JSON.stringify({
          question: sent,
          history: turns
            .flatMap((t) => [
              { role: "user", content: t.question },
              { role: "assistant", content: t.answer.slice(0, 4000) },
            ])
            .slice(-6),
          use_wiki: useWiki,
          article_path: useWiki ? articleContext?.path : null,
        }),
      });
      if (request.signal.aborted) return;
      await store.update([...turns, { question: sent, ...data }]);
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
                      <button key={s.id} onClick={() => setSelected(s)}>
                        [{s.id}] {s.title}
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
            aria-describedby="ai-keyboard-hint"
          />
          <div className="ai-compose-controls">
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
      {selected && (
        <ArticleDialog reference={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}
