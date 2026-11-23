import { VoicePresence } from "./VoicePresence";
import { voiceControl } from "./VoiceCompanion";
import { AnswerActions, useReadAloud } from "./SpeechControls";
import { SourceLink } from "./Briefing";
import { AnswerMarkdown } from "./AnswerMarkdown";
import { Info } from "./Info";
import { DocumentReader, type DocumentSource } from "./DocumentReader";
import { NotebookSave } from "./Notebook";
import { useConversations, downloadJSON } from "./useConversations";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Paperclip, Plus, SlidersHorizontal, X, Mic, Square } from "lucide-react";
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
  sources: (WikiReference & {
    id: number;
    url?: string | null;
    fileId?: number | null;
    page?: number | null;
  })[];
  images: {
    path: string;
    caption: string;
    articlePath: string;
    title: string;
    sourceId: number;
  }[];
};
const attachmentTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
];

function encodeAttachment(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
    reader.onerror = () =>
      reject(new Error("The attachment could not be read."));
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
  const reader = useReadAloud();
  const historyDialog = useRef<HTMLDialogElement>(null);
  const { turns, context: articleContext } = store.chat;
  const [historyOpen, setHistoryOpen] = useState(false);
  useEffect(() => {
    if (historyOpen) historyDialog.current?.showModal();
  }, [historyOpen]);
  useEffect(() => {
    reader.stop();
  }, [store.chat.id]);
  const [selectedChats, setSelectedChats] = useState<string[]>([]);
  const [rename, setRename] = useState("");
  useEffect(() => {
    onClearContext();
    onConsumeAttachment?.();
  }, []);
  const [status, setStatus] = useState<{
    configured: boolean;
    model: string;
    local?: { configured: boolean; model: string };
    cloud?: { configured: boolean; model: string };
  } | null>(null);
  const [provider, setProvider] = useState<"local" | "cloud">(() =>
    localStorage.getItem("klinekraft.ai.provider") === "cloud"
      ? "cloud"
      : "local",
  );
  const [referenceOnly, setReferenceOnly] = useState(() => {
    try {
      return localStorage.getItem("klinekraft.ai.referenceOnly") === "true";
    } catch {
      return false;
    }
  });
  const ready =
    provider === "local" && referenceOnly
      ? true
      : (status?.[provider]?.configured ??
        (status?.local ? false : status?.configured));
  const recipient =
    provider === "local"
      ? referenceOnly
        ? "the local reference reader (no AI request)"
        : "the local model on this Pi"
      : "OpenAI";
  const [question, setQuestion] = useState("");
  const [readReplies, setReadReplies] = useState(() => localStorage.getItem("klinekraft.ai.readReplies") === "true");
  const [attachment, setAttachment] = useState<File | null>(
    initialAttachment ?? null,
  );
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
  const [useDiagnostics, setUseDiagnostics] = useState(false);
  const [useResearch, setUseResearch] = useState(true);
  const [useEvents, setUseEvents] = useState(true);
  const [onlineResearch, setOnlineResearch] = useState(false);
  const [researchSource, setResearchSource] = useState<DocumentSource | null>(
    null,
  );
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
    busy ||
    isHostedDemo ||
    store.loading ||
    store.saving ||
    store.dirty ||
    turns.length >= 200;
  async function ask(e: FormEvent) {
    e.preventDefault();
    if (!question.trim() || composerDisabled || !ready) return;
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
        signal: AbortSignal.any([
          request.signal,
          AbortSignal.timeout(provider === "local" ? 260000 : 120000),
        ]),
        body: JSON.stringify({
          provider,
          reference_only: provider === "local" && referenceOnly,
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
          use_events: useEvents,
          online_research: provider === "cloud" && onlineResearch,
          use_diagnostics:
            useDiagnostics && !(provider === "local" && referenceOnly),
          article_path: useWiki ? articleContext?.path : null,
        }),
      });
      if (request.signal.aborted) return;
      setAttachment(null);
      await store.update([
        ...turns,
        { question: sent, attachmentName: attachment?.name, ...data },
      ]);
      if (readReplies) void reader.speak(data.answer, turns.length);
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
  function openResearchSource(source: Turn["sources"][number]) {
    setResearchSource({
      title: source.title,
      url: `/api/research/${source.fileId}`,
      page: source.page,
    });
  }

  return (
    <section
      className={
        "assistant-panel ai-chat shack-chat" +
        (!turns.length && !busy ? " shack-welcome" : "")
      }
      aria-label="Shackleton AI assistant"
    >
      <div className="ai-chat-toolbar">
        <button
          className="k-btn k-btn--quiet"
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
          <Plus size={16} aria-hidden="true" /> New chat
        </button>
        <button
          className="k-btn k-btn--quiet"
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
            <span>{provider === "local" ? "Offline" : "Cloud"}</span>
          </summary>
          <div className="ai-options-content">
            <label><input type="checkbox" checked={readReplies} onChange={e => { setReadReplies(e.target.checked); localStorage.setItem("klinekraft.ai.readReplies", String(e.target.checked)); }} />Read new answers aloud</label>
            <label>
              <input
                type="checkbox"
                checked={useResearch}
                onChange={(e) => setUseResearch(e.target.checked)}
                disabled={busy}
              />
              Use saved library references
            </label>
            <label>
              <input
                type="checkbox"
                checked={useDiagnostics}
                onChange={(e) => setUseDiagnostics(e.target.checked)}
                disabled={busy || (provider === "local" && referenceOnly)}
              />
              Include Pi diagnostics
            </label>
            <label>
              <input
                type="checkbox"
                checked={useWiki}
                onChange={(e) => setUseWiki(e.target.checked)}
                disabled={busy}
              />{" "}
              Use local Wikipedia
            </label>
            <label>
              <input
                type="checkbox"
                checked={useEvents}
                onChange={(e) => setUseEvents(e.target.checked)}
              />
              Use saved event reports
            </label>
            {provider === "cloud" && (
              <label>
                <input
                  type="checkbox"
                  checked={onlineResearch}
                  onChange={(e) => setOnlineResearch(e.target.checked)}
                />
                Search papers online (sends search to OpenAlex / Europe PMC)
              </label>
            )}
            <label>
              Answer engine{" "}
              <select
                className="k-select"
                value={provider}
                disabled={busy}
                onChange={(e) => {
                  const next = e.target.value as "local" | "cloud";
                  setProvider(next);
                  localStorage.setItem("klinekraft.ai.provider", next);
                }}
              >
                <option value="local">Offline · this Pi</option>
                <option value="cloud">Cloud · OpenAI</option>
              </select>
            </label>
            {provider === "local" && (
              <label>
                <input
                  type="checkbox"
                  checked={referenceOnly}
                  disabled={busy}
                  onChange={(e) => {
                    setReferenceOnly(e.target.checked);
                    try {
                      localStorage.setItem(
                        "klinekraft.ai.referenceOnly",
                        String(e.target.checked),
                      );
                    } catch {}
                  }}
                />{" "}
                Quote guides directly (no AI rewriting)
              </label>
            )}
            {provider === "local" && (
              <p>
                {referenceOnly
                  ? "Quote guides directly shows saved excerpts immediately. Uncheck it for AI explanations of general questions."
                  : "AI answers can misread safety guidance. Use direct guide quotations for emergency and medical questions."}
              </p>
            )}
            <p>
              {status?.[provider]?.model ||
                (provider === "local" ? "Local model" : status?.model)}
            </p>
            <p>
              {provider === "local"
                ? "Works without internet after installation. Smaller model; answers may take longer. No automatic cloud fallback."
                : "Questions, recent messages and selected references go to OpenAI. Internet and API billing required."}
            </p>
            <p>
              Chats are saved on this Pi. Only recent messages are sent with
              each question. Wikipedia stays available offline.
            </p>
          </div>
        </details>
      </div>
      {historyOpen && (
        <dialog
          ref={historyDialog}
          className="ai-history"
          aria-label="Saved conversations"
          onCancel={() => setHistoryOpen(false)}
        >
          <div className="ai-history-heading">
            <input
              className="k-field"
              type="search"
              aria-label="Search conversations"
              placeholder="Search conversations"
              value={store.query}
              onChange={(e) => store.setQuery(e.target.value)}
            />
            <button
              className="k-btn k-btn--quiet"
              onClick={() => setHistoryOpen(false)}
            >
              Close
            </button>
          </div>
          <div className="chat-selection" hidden={!store.items.length}>
            <button
              className="k-btn"
              disabled={busy || store.saving || store.dirty}
              onClick={() =>
                setSelectedChats(
                  selectedChats.length ? [] : store.items.map((i) => i.id),
                )
              }
            >
              {selectedChats.length ? "Clear selection" : "Select all"}
            </button>
            <button
              className="k-btn k-btn--danger"
              disabled={
                !selectedChats.length || busy || store.saving || store.dirty
              }
              onClick={() =>
                void store
                  .removeMany(selectedChats)
                  .then(() => setSelectedChats([]))
              }
            >
              Delete selected ({selectedChats.length})
            </button>
          </div>
          <div className="ai-history-list">
            {store.items.map((item) => (
              <div className="chat-history-row" key={item.id}>
                <input
                  type="checkbox"
                  aria-label={`Select ${item.title}`}
                  checked={selectedChats.includes(item.id)}
                  onChange={(e) =>
                    setSelectedChats(
                      e.target.checked
                        ? [...selectedChats, item.id]
                        : selectedChats.filter((id) => id !== item.id),
                    )
                  }
                />
                <button
                  disabled={
                    busy || store.saving || store.loading || store.dirty
                  }
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
              </div>
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
                className="k-field"
                aria-label="Conversation title"
                value={rename}
                maxLength={120}
                onChange={(e) => setRename(e.target.value)}
              />
              <button
                className="k-btn"
                disabled={busy || store.saving || store.dirty || !rename.trim()}
              >
                Rename
              </button>
              <button
                type="button"
                className="k-btn k-btn--danger"
                disabled={busy || store.saving || store.dirty}
                onClick={() => void store.remove()}
              >
                Delete
              </button>
            </form>
          )}
          <div className="ai-history-heading">
            <button
              className="k-btn k-btn--quiet"
              onClick={() => void store.exportAll()}
            >
              Export all chats
            </button>
            <button className="k-btn k-btn--quiet" onClick={store.refresh}>
              Refresh
            </button>
          </div>
        </dialog>
      )}
      {store.error && (
        <div role="alert" className="ai-save-error">
          {store.error}
          {store.dirty && (
            <div>
              <button
                className="k-btn k-btn--primary"
                disabled={store.saving}
                onClick={() => void store.retry()}
              >
                Retry save
              </button>
              <button
                className="k-btn"
                disabled={store.saving}
                onClick={() => void store.copy()}
              >
                Save separate copy
              </button>
              <button
                className="k-btn"
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
        ) : status && !ready ? (
          <div className="k-empty ai-setup">
            <h3>
              {provider === "local"
                ? "Offline Shackleton is not ready"
                : "Connect your cloud assistant"}
            </h3>
            <p>
              {provider === "local"
                ? "Check the local model service in a Terminal on the Pi, then check again here."
                : "Run AI setup in a Terminal on the Pi to enter your OpenAI API key privately."}
            </p>
            <code>
              {provider === "local"
                ? "systemctl --user status klinekraft-ai"
                : "python3 ~/klinekraft-terminal/scripts/setup-ai.py"}
            </code>
            <button
              className="k-btn"
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
            <img
              className="shackleton-logo"
              src="/shackleton.svg"
              alt="Shackleton"
              width="115"
              height="120"
            />
            <p>What would you like to explore?</p>
          </div>
        ) : null}
        <div className="ai-conversation">
          {turns.map((turn, i) => (
            <article className="ai-turn" key={i}>
              <h2 className="ai-user-message">{turn.question}</h2>
              {turn.attachmentName && (
                <p className="ai-notice">Attachment: {turn.attachmentName}</p>
              )}
              <div className="ai-answer">
                <AnswerMarkdown text={turn.answer} />
              </div>
              <div className="answer-tools">
                <AnswerActions text={turn.answer} index={i} reader={reader} />
                <NotebookSave turn={turn} />
                {turn.notice && (
                  <Info label="Answer details">
                    <p>{turn.notice}</p>
                  </Info>
                )}
              </div>
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
                    {turn.sources.map((s) =>
                      s.url ? (
                        <SourceLink key={s.id} url={s.url}>
                          [{s.id}] {s.title}
                        </SourceLink>
                      ) : (
                        <button
                          key={s.id}
                          onClick={() =>
                            s.fileId
                              ? void openResearchSource(s)
                              : setSelected(s)
                          }
                        >
                          [{s.id}] {s.title}
                          {s.page ? ` · page ${s.page}` : ""}
                        </button>
                      ),
                    )}
                  </div>
                </details>
              )}
            </article>
          ))}
          {busy && (
            <article className="ai-turn">
              <h2 className="ai-user-message">{pending}</h2>
              <VoicePresence phase="thinking" />
              <p className="ai-thinking" role="status">
                {useWiki ? "Reading and thinking…" : "Thinking…"}
              </p>
              <button className="k-btn k-btn--quiet" onClick={() => { controller.current?.abort(); setQuestion(pending); setPending(""); setBusy(false); }}><Square size={14} />Stop response</button>
            </article>
          )}
          <div ref={end} />
        </div>
      </div>
      <div className="ai-compose-area">
        {reader.error && (
          <p role="alert" className="browser-warning">
            {reader.error}
          </p>
        )}
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
          <button type="button" className="icon-button" aria-label="Speak to Shackleton" disabled={busy || isHostedDemo} onClick={() => void voiceControl("listen").catch(e => setError(e.message))}><Mic size={17} /></button>
          <input
            type="file"
            ref={fileInput}
            accept={attachmentTypes.join(",")}
            hidden
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (!file) return;
              if (
                !attachmentTypes.includes(file.type) ||
                !file.size ||
                file.size > 8 * 1024 * 1024 ||
                file.name.length > 255
              ) {
                setError(
                  "Choose a PNG, JPEG, WebP or PDF up to 8 MiB with a filename of 255 characters or fewer.",
                );
                return;
              }
              setAttachment(file);
              setError("");
            }}
          />
          {attachment && (
            <div className="ai-attachment">
              {preview &&
                (!attachment.type.startsWith("image/") ? (
                  <a href={preview} target="_blank" rel="noopener noreferrer">
                    Preview attachment
                  </a>
                ) : (
                  <img src={preview} alt="Attachment preview" />
                ))}
              <span>{attachment.name}</span>
              <button
                type="button"
                className="k-btn k-btn--quiet k-btn--icon"
                disabled={busy}
                onClick={() => setAttachment(null)}
                aria-label="Remove attachment"
              >
                <X size={14} />
              </button>
              <p id="ai-upload-note" className="ai-notice">
                {attachment.type === "text/plain"
                  ? `Sending shares this note with ${recipient}. Chat history`
                  : `Sending shares this file with ${recipient} for this answer. Chat history`}{" "}
                saves the filename and answer on the Pi.
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
                className="k-btn k-btn--quiet k-btn--icon"
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
            placeholder="Message Shackleton…"
            disabled={
              busy ||
              isHostedDemo ||
              store.loading ||
              store.saving ||
              store.dirty ||
              turns.length >= 200
            }
            aria-describedby={
              attachment
                ? "ai-keyboard-hint ai-upload-note"
                : "ai-keyboard-hint"
            }
          />
          {useDiagnostics && !(provider === "local" && referenceOnly) && (
            <p className="ai-notice">
              Sending shares current CPU, memory, storage, temperature, battery
              and Klinekraft service status with {recipient}.
            </p>
          )}
          <div className="ai-compose-controls">
            <button
              className="ai-quiet-button"
              type="button"
              aria-label="Attach image or PDF"
              title="Attach image or PDF"
              disabled={composerDisabled || !ready}
              onClick={() => fileInput.current?.click()}
            >
              <Paperclip size={17} />
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
                !ready ||
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
        <DocumentReader
          key={researchSource.url + ":" + researchSource.page}
          source={researchSource}
          onClose={() => setResearchSource(null)}
        />
      )}
      {selected && (
        <ArticleDialog reference={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}
