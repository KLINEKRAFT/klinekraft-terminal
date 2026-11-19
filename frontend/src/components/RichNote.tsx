import { useLayoutEffect, useRef, useState } from "react";
const marker = "<!--kk-rich-v1-->";
const allowed = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "S",
  "STRIKE",
  "H2",
  "H3",
  "P",
  "DIV",
  "BR",
  "UL",
  "OL",
  "LI",
  "BLOCKQUOTE",
]);
function clean(html: string) {
  const source = new DOMParser().parseFromString(html, "text/html");
  function copy(node: Node): Node {
    if (node.nodeType === Node.TEXT_NODE)
      return document.createTextNode(node.textContent || "");
    const element = node as Element;
    if (["SCRIPT", "STYLE", "IFRAME", "OBJECT"].includes(element.tagName))
      return document.createTextNode("");
    const out = allowed.has(element.tagName)
      ? document.createElement(element.tagName.toLowerCase())
      : document.createDocumentFragment();
    node.childNodes.forEach((child) => out.appendChild(copy(child)));
    return out;
  }
  const container = document.createElement("div");
  source.body.childNodes.forEach((node) => container.appendChild(copy(node)));
  return container.innerHTML;
}
export function noteText(body: string) {
  return body.startsWith(marker)
    ? new DOMParser().parseFromString(body.slice(marker.length), "text/html")
        .body.textContent || ""
    : body;
}
export function RichNote({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const editor = useRef<HTMLDivElement>(null),
    last = useRef("");
  const history = useRef([value]);
  const cursor = useRef(0);
  const [, refresh] = useState(0);
  function remember(next: string) {
    if (history.current[cursor.current] === next) return;
    history.current = history.current.slice(0, cursor.current + 1);
    history.current.push(next);
    if (history.current.length > 250) history.current.shift();
    cursor.current = history.current.length - 1;
    refresh((n) => n + 1);
  }
  function undo(direction: number) {
    const index = cursor.current + direction;
    if (index < 0 || index >= history.current.length || !editor.current) return;
    cursor.current = index;
    const next = history.current[index];
    if (next.startsWith(marker))
      editor.current.innerHTML = clean(next.slice(marker.length));
    else editor.current.textContent = next;
    last.current = next;
    editor.current.focus();
    const range = document.createRange();
    range.selectNodeContents(editor.current);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    onChange(next);
    refresh((n) => n + 1);
  }
  useLayoutEffect(() => {
    if (!editor.current || last.current === value) return;
    if (value.startsWith(marker))
      editor.current.innerHTML = clean(value.slice(marker.length));
    else editor.current.textContent = value;
    last.current = value;
    remember(value);
  }, [value]);
  function changed() {
    const value = marker + clean(editor.current?.innerHTML || "");
    last.current = value;
    remember(value);
    onChange(value);
  }
  function format(command: string, value?: string) {
    editor.current?.focus();
    document.execCommand(command, false, value);
    changed();
  }
  return (
    <div className="rich-note">
      <div className="note-format" role="toolbar" aria-label="Note formatting">
        <button
          type="button"
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
          disabled={cursor.current === 0}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => undo(-1)}
        >
          ↶
        </button>
        <button
          type="button"
          aria-label="Redo"
          title="Redo (Ctrl+Shift+Z)"
          disabled={cursor.current === history.current.length - 1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => undo(1)}
        >
          ↷
        </button>
        {(
          [
            ["Bold", "bold", "B"],
            ["Italic", "italic", "I"],
            ["Underline", "underline", "U"],
            ["Bullets", "insertUnorderedList", "•"],
            ["Numbered list", "insertOrderedList", "1."],
          ] as const
        ).map(([label, cmd, text]) => (
          <button
            key={cmd}
            type="button"
            aria-label={label}
            title={label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => format(cmd)}
          >
            {text}
          </button>
        ))}
        <button
          type="button"
          title="Heading"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => format("formatBlock", "h2")}
        >
          Aa
        </button>
        <button
          type="button"
          title="Checklist"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => format("insertText", "☐ ")}
        >
          ☐
        </button>
        <button
          type="button"
          title="Plain text"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            format("removeFormat");
            format("formatBlock", "div");
          }}
        >
          Tx
        </button>
      </div>
      <div
        ref={editor}
        className="note-paper"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Note"
        aria-multiline="true"
        onInput={changed}
        onKeyDown={(e) => {
          if (
            (e.ctrlKey || e.metaKey) &&
            !e.altKey &&
            ["z", "y"].includes(e.key.toLowerCase())
          ) {
            e.preventDefault();
            undo(e.shiftKey || e.key.toLowerCase() === "y" ? 1 : -1);
          }
        }}
        onPaste={(e) => {
          e.preventDefault();
          format("insertText", e.clipboardData.getData("text/plain"));
        }}
      />
    </div>
  );
}
