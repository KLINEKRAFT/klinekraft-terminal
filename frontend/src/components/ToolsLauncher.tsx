import { useEffect, useRef, useState } from "react";
import { Wrench, X, ArrowUpRight } from "lucide-react";
import { isHostedDemo } from "../runtime";
type Tool = {
  id: string;
  title: string;
  description: string;
  unavailable: string | null;
};
const headers = { "X-Klinekraft-Client": "local-ui" };
export function ToolsLauncher() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="away-launch" onClick={() => setOpen(true)}>
        <Wrench size={15} /> Tools
      </button>
      {open && <ToolsDialog onClose={() => setOpen(false)} />}
    </>
  );
}
function ToolsDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(!isHostedDemo);
  const [launching, setLaunching] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  useEffect(() => {
    if (isHostedDemo) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let mounted = true;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const response = await fetch("/api/tools", {
          headers,
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok)
          throw Error(
            "Tools are unavailable. Update or restart the local service.",
          );
        const data = await response.json();
        if (
          !Array.isArray(data.tools) ||
          !data.tools.every(
            (t: Tool) =>
              t &&
              typeof t.id === "string" &&
              typeof t.title === "string" &&
              typeof t.description === "string" &&
              (t.unavailable === null || typeof t.unavailable === "string"),
          )
        )
          throw Error("Update the local service to connect Tools.");
        if (mounted) setTools(data.tools);
      } catch (e) {
        if (mounted) {
          setTools([]);
          setError(
            controller.signal.aborted
              ? "Tools request timed out. Check the local service."
              : (e as Error).message,
          );
        }
      } finally {
        clearTimeout(timeout);
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [revision]);
  async function launch(tool: Tool) {
    if (launching) return;
    setLaunching(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/tools/launch", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ tool_id: tool.id }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await response.json();
      if (!response.ok)
        throw Error(
          typeof data.detail === "string"
            ? data.detail
            : "Could not open utility.",
        );
      setMessage(
        `${tool.title} requested. Look for its terminal window; Alt + Tab switches windows.`,
      );
    } catch (e) {
      setError(
        (e as Error).name === "TimeoutError"
          ? "Launch response timed out. Check for an open terminal before retrying."
          : (e as Error).message,
      );
    } finally {
      setLaunching(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="tools-dialog"
      aria-label="Desktop tools"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <div>
          <span className="eyebrow">LOCAL UTILITIES</span>
          <h2>Tools</h2>
        </div>
        <button onClick={onClose} aria-label="Close Tools">
          <X size={18} />
        </button>
      </header>
      <p className="tools-intro">
        Small tools. Each opens in its own terminal window.
      </p>
      {isHostedDemo ? (
        <p>
          Available in the installed Pi app. The web demo cannot open desktop
          utilities.
        </p>
      ) : (
        <>
          {loading && <p role="status">Checking installed tools…</p>}
          <div className="tools-list">
            {tools.map((tool) => (
              <div key={tool.id}>
                <div>
                  <strong>{tool.title}</strong>
                  <p>{tool.description}</p>
                  {tool.unavailable && <small>{tool.unavailable}</small>}
                </div>
                <button
                  disabled={loading || launching || !!tool.unavailable}
                  onClick={() => void launch(tool)}
                  aria-label={`Open ${tool.title}`}
                >
                  <ArrowUpRight size={18} />
                </button>
              </div>
            ))}
          </div>
          {message && <p role="status">{message}</p>}
          {error && <p role="alert">{error}</p>}
          <footer>
            <small>Close a utility’s window to return.</small>
            <button
              onClick={() => setRevision((r) => r + 1)}
              disabled={loading}
            >
              Refresh
            </button>
          </footer>
        </>
      )}
    </dialog>
  );
}
