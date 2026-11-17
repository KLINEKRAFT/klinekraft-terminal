import { useLayoutEffect, useRef } from "react";
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
  useLayoutEffect(() => {
    if (!editor.current || last.current === value) return;
    if (value.startsWith(marker))
      editor.current.innerHTML = clean(value.slice(marker.length));
    else editor.current.textContent = value;
    last.current = value;
  }, [value]);
  function changed() {
    const value = marker + clean(editor.current?.innerHTML || "");
    last.current = value;
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
        onPaste={(e) => {
          e.preventDefault();
          format("insertText", e.clipboardData.getData("text/plain"));
        }}
      />
    </div>
  );
}
