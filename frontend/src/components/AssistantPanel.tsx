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
  turns,
  onTurns,
  context,
  onClearContext,
}: {
  turns: Turn[];
  onTurns: (t: Turn[]) => void;
  context: WikiReference | null;
  onClearContext: () => void;
}) {
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
    if (!question.trim() || busy || !status?.configured || isHostedDemo) return;
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
          article_path: useWiki ? context?.path : null,
        }),
      });
      if (request.signal.aborted) return;
      onTurns([...turns, { question: sent, ...data }].slice(-12));
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
          disabled={busy || (!turns.length && !context)}
          onClick={() => {
            onTurns([]);
            onClearContext();
            setQuestion("");
            setError("");
            input.current?.focus();
          }}
        >
          <Plus size={15} /> New chat
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
            <p>Chat clears on reload. Wikipedia stays available offline.</p>
          </div>
        </details>
      </div>
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
        {error && (
          <p role="alert" className="browser-warning">
            {error}
          </p>
        )}
        <form className="ai-composer" onSubmit={ask}>
          {context && (
            <div className="ai-context">
              <span>
                Article: {context.title}
                {!useWiki && " · not included"}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={onClearContext}
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
            disabled={busy || isHostedDemo}
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
                busy || !status?.configured || !question.trim() || isHostedDemo
              }
            >
              <ArrowUp size={18} />
            </button>
          </div>
        </form>
        <p id="ai-keyboard-hint" className="ai-chat-footer">
          Enter to send · Shift + Enter for a new line. AI can make mistakes.
        </p>
      </div>
      {selected && (
        <ArticleDialog reference={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}
