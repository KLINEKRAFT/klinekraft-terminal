import { useEffect, useRef, useState, type FormEvent } from "react";
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
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    if (isHostedDemo) return;
    const request = new AbortController();
    void localJSON("/api/ai/status", {
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)]),
    })
      .then(setStatus)
      .catch((e) => {
        if (!request.signal.aborted) setError(e.message);
      });
    return () => request.abort();
  }, [revision]);
  useEffect(() => () => controller.current?.abort(), []);
  async function ask(e: FormEvent) {
    e.preventDefault();
    if (!question.trim() || busy) return;
    setBusy(true);
    setError("");
    controller.current = new AbortController();
    try {
      const data = await localJSON("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.any([
          controller.current.signal,
          AbortSignal.timeout(120000),
        ]),
        body: JSON.stringify({
          question,
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
      onTurns([...turns, { question, ...data }].slice(-12));
      setQuestion("");
    } catch (e) {
      if (!controller.current.signal.aborted)
        setError(
          (e as Error).name === "TimeoutError"
            ? "The answer timed out. The provider may still have processed the request."
            : (e as Error).message,
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="assistant-panel" aria-label="Cloud AI assistant">
      <div className="assistant-meta">
        <span className="eyebrow">
          {isHostedDemo
            ? "LOCAL APP REQUIRED"
            : status?.configured
              ? "OPENAI · CONFIGURED"
              : "OPENAI · SETUP NEEDED"}
        </span>
        <button
          className="browser-button"
          disabled={busy || !turns.length}
          onClick={() => onTurns([])}
        >
          Clear chat
        </button>
      </div>
      <p className="browser-help">
        Ask a question or explore your local Wikipedia. Questions, recent
        conversation and relevant article excerpts go to OpenAI. Internet and
        API billing are required.
      </p>
      {!isHostedDemo && status && !status.configured && (
        <div className="ai-setup">
          <p>Add your API key in the Pi’s Terminal. It stays on the Pi.</p>
          <pre>cd ~/klinekraft-terminal{"\n"}python3 scripts/setup-ai.py</pre>
          <button
            className="browser-button"
            onClick={() => {
              setError("");
              setRevision((r) => r + 1);
            }}
          >
            Check setup
          </button>
        </div>
      )}
      {context && (
        <div className="ai-context">
          <span>Article: {context.title}</span>
          <button disabled={busy} onClick={onClearContext}>
            Remove
          </button>
        </div>
      )}
      <div className="ai-conversation">
        {turns.map((turn, i) => (
          <article className="ai-turn" key={i}>
            <h2>{turn.question}</h2>
            {turn.notice && <p className="ai-notice">{turn.notice}</p>}
            <div className="ai-answer">{turn.answer}</div>
            {!!turn.sources.length && (
              <div className="ai-sources">
                <span className="eyebrow">SOURCES CONSULTED</span>
                {turn.sources.map((s) => (
                  <button key={s.id} onClick={() => setSelected(s)}>
                    [{s.id}] {s.title}
                  </button>
                ))}
              </div>
            )}
            {!!turn.images.length && (
              <div className="ai-images">
                {turn.images.map((img) => (
                  <div key={img.path}>
                    <WikiImage path={img.path} caption={img.caption} />
                    <button
                      onClick={() =>
                        setSelected({ path: img.articlePath, title: img.title })
                      }
                    >
                      From {img.title} · image credits
                    </button>
                  </div>
                ))}
              </div>
            )}
            <small className="ai-footnote">
              AI-generated. Check important claims against the linked articles.
            </small>
          </article>
        ))}
      </div>
      <form className="ai-composer" onSubmit={ask}>
        <label htmlFor="ai-question">Your question</label>
        <textarea
          id="ai-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={3000}
          rows={3}
          placeholder="What would you like to explore?"
          disabled={busy || isHostedDemo}
        />
        <div>
          <label>
            <input
              type="checkbox"
              checked={useWiki}
              onChange={(e) => setUseWiki(e.target.checked)}
              disabled={busy}
            />{" "}
            Refer to local Wikipedia
          </label>
          <button
            className="browser-button primary"
            disabled={
              busy || !status?.configured || !question.trim() || isHostedDemo
            }
          >
            {busy ? "Preparing answer…" : "Ask"}
          </button>
        </div>
      </form>
      {busy && (
        <p role="status">
          Reading available sources and preparing your answer…
        </p>
      )}
      {error && (
        <p role="alert" className="browser-warning">
          {error}
        </p>
      )}
      <p className="ai-footnote">
        Chat lasts until this page is reloaded. Wikipedia remains readable
        offline.
      </p>
      {selected && (
        <ArticleDialog reference={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}
