import {
  Bold,
  Heading2,
  Italic,
  List,
  ListOrdered,
  ListTodo,
  Redo2,
  RemoveFormatting,
  Underline,
  Undo2,
} from "lucide-react";
import {
  Fragment,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
  const keep = (e: { preventDefault: () => void }) => e.preventDefault();
  const tools: [string, string, ReactNode, () => void][] = [
    ["Bold", "Bold (Ctrl+B)", <Bold size={18} />, () => format("bold")],
    ["Italic", "Italic (Ctrl+I)", <Italic size={18} />, () => format("italic")],
    [
      "Underline",
      "Underline (Ctrl+U)",
      <Underline size={18} />,
      () => format("underline"),
    ],
    ["Heading", "Heading", <Heading2 size={18} />, () => format("formatBlock", "h2")],
    [
      "Bullets",
      "Bulleted list",
      <List size={18} />,
      () => format("insertUnorderedList"),
    ],
    [
      "Numbered list",
      "Numbered list",
      <ListOrdered size={18} />,
      () => format("insertOrderedList"),
    ],
    [
      "Checklist",
      "Checklist item",
      <ListTodo size={18} />,
      () => format("insertText", "☐ "),
    ],
    [
      "Plain text",
      "Clear formatting",
      <RemoveFormatting size={18} />,
      () => {
        format("removeFormat");
        format("formatBlock", "div");
      },
    ],
  ];
  return (
    <div className="rich-note">
      <div className="note-format" role="toolbar" aria-label="Note formatting">
        <button
          type="button"
          className="k-btn k-btn--quiet k-btn--icon"
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
          disabled={cursor.current === 0}
          onMouseDown={keep}
          onClick={() => undo(-1)}
        >
          <Undo2 size={18} />
        </button>
        <button
          type="button"
          className="k-btn k-btn--quiet k-btn--icon"
          aria-label="Redo"
          title="Redo (Ctrl+Shift+Z)"
          disabled={cursor.current === history.current.length - 1}
          onMouseDown={keep}
          onClick={() => undo(1)}
        >
          <Redo2 size={18} />
        </button>
        {tools.map(([label, title, icon, run], index) => (
          <Fragment key={label}>
            {(index === 0 || index === 3 || index === 7) && (
              <span className="note-format-gap" aria-hidden="true" />
            )}
            <button
              type="button"
              className="k-btn k-btn--quiet k-btn--icon"
              aria-label={label}
              title={title}
              onMouseDown={keep}
              onClick={run}
            >
              {icon}
            </button>
          </Fragment>
        ))}
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
