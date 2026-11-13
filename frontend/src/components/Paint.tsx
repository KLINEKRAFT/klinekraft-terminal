import { useEffect, useRef, useState } from "react";
import {
  Pencil,
  Paintbrush,
  Eraser,
  PaintBucket,
  Pipette,
  Minus,
  Square,
  Circle,
  Type,
  Scan,
  Undo2,
  Redo2,
  Download,
  FolderOpen,
  Plus,
  Save,
  Crop,
  FlipHorizontal2,
  RotateCw,
  ArrowLeftRight,
  Trash2,
} from "lucide-react";
import { localJSON } from "./WikiReader";
import { isHostedDemo } from "../runtime";
import { floodFill } from "./paintPixels";

type Drawing = {
  id: string;
  kind: "drawing";
  title: string;
  body: string;
  revision: number;
  archived: boolean;
};
type Point = { x: number; y: number };
type Box = Point & { w: number; h: number };
type Tool =
  | "pencil"
  | "brush"
  | "eraser"
  | "fill"
  | "picker"
  | "line"
  | "rectangle"
  | "ellipse"
  | "text"
  | "select";
const tools = [
  { id: "select", label: "Select", key: "S", icon: Scan },
  { id: "pencil", label: "Pencil", key: "P", icon: Pencil },
  { id: "brush", label: "Brush", key: "B", icon: Paintbrush },
  { id: "eraser", label: "Eraser", key: "E", icon: Eraser },
  { id: "fill", label: "Fill", key: "F", icon: PaintBucket },
  { id: "picker", label: "Pick color", key: "I", icon: Pipette },
  { id: "line", label: "Line", key: "L", icon: Minus },
  { id: "rectangle", label: "Rectangle", key: "R", icon: Square },
  { id: "ellipse", label: "Ellipse", key: "O", icon: Circle },
  { id: "text", label: "Text", key: "T", icon: Type },
] as const;
const palette = [
  "#242424",
  "#ffffff",
  "#ff6a00",
  "#003da5",
  "#777777",
  "#d1d1c8",
  "#b52c36",
  "#e78086",
  "#c57b22",
  "#f0ca37",
  "#258149",
  "#8fc47a",
  "#167c86",
  "#73cbd0",
  "#7952a3",
  "#bb95d9",
];
const draftKey = "klinekraft.paint.draft";
const fresh = (): Drawing => ({
  id: crypto.randomUUID(),
  kind: "drawing",
  title: "Untitled drawing",
  body: "",
  revision: 0,
  archived: false,
});
const hints: Record<Tool, string> = {
  select:
    "Drag to select. Drag inside to move. Crop or Delete to edit the selection.",
  pencil: "Draw a fine line. Right-click uses the background color.",
  brush: "Draw freehand. Choose a brush width above.",
  eraser: "Erase to the background color.",
  fill: "Click to fill a connected area with the selected color.",
  picker: "Click the canvas to sample a color.",
  line: "Drag a line. Hold Shift to constrain its angle.",
  rectangle: "Drag a rectangle. Hold Shift for a square.",
  ellipse: "Drag an ellipse. Hold Shift for a circle.",
  text: "Enter text above, then click the canvas to place it.",
};

export function Paint() {
  const canvas = useRef<HTMLCanvasElement>(null),
    workspace = useRef<HTMLDivElement>(null),
    fileInput = useRef<HTMLInputElement>(null);
  const document = useRef<Drawing>(fresh());
  const [drawing, setDrawing] = useState(document.current),
    [saved, setSaved] = useState<Drawing[]>([]);
  const [tool, setTool] = useState<Tool>("brush"),
    [foreground, setForeground] = useState("#242424"),
    [background, setBackground] = useState("#ffffff");
  const [size, setSize] = useState(4),
    [fillStyle, setFillStyle] = useState("outline"),
    [zoom, setZoom] = useState(0);
  const [dimensions, setDimensions] = useState({ w: 960, h: 600 });
  const [text, setText] = useState(""),
    [fontSize, setFontSize] = useState(28);
  const [status, setStatus] = useState("Ready"),
    [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [ready, setReady] = useState(false);
  const [selection, setSelection] = useState<Box | null>(null),
    [position, setPosition] = useState<Point | null>(null);
  const undo = useRef<ImageData[]>([]),
    redo = useRef<ImageData[]>([]);
  const [, refreshHistory] = useState(0);
  const stroke = useRef<{
    start: Point;
    last: Point;
    base: ImageData;
    pointer: number;
    color: string;
    moving?: Box;
    pixels?: HTMLCanvasElement;
  } | null>(null);
  const loadSequence = useRef(0);
  const generation = useRef(0),
    inFlight = useRef(false),
    failed = useRef(false),
    alive = useRef(true);
  const ctx = () =>
    canvas.current!.getContext("2d", { willReadFrequently: true })!;
  const snapshot = () =>
    ctx().getImageData(0, 0, canvas.current!.width, canvas.current!.height);
  function restore(image: ImageData) {
    canvas.current!.width = image.width;
    canvas.current!.height = image.height;
    ctx().putImageData(image, 0, 0);
    setDimensions({ w: image.width, h: image.height });
  }
  function updateDocument(next: Drawing) {
    document.current = next;
    setDrawing(next);
  }
  function recoverable(next: Drawing) {
    try {
      localStorage.setItem(draftKey, JSON.stringify(next));
      return true;
    } catch {
      return false;
    }
  }
  function changed() {
    const next = {
      ...document.current,
      body: canvas.current!.toDataURL("image/png"),
    };
    updateDocument(next);
    generation.current++;
    failed.current = false;
    setDirty(true);
    setStatus(
      recoverable(next)
        ? "Unsaved changes"
        : "Recovery storage is full. Save or export before leaving Paint.",
    );
  }
  function checkpoint(before: ImageData) {
    // Keep history under about 48 MiB even for imported images.
    undo.current.push(before);
    let bytes = undo.current.reduce(
      (total, image) => total + image.data.byteLength,
      0,
    );
    while (bytes > 48 * 1024 * 1024 && undo.current.length > 1)
      bytes -= undo.current.shift()!.data.byteLength;
    redo.current = [];
    refreshHistory((value) => value + 1);
    changed();
  }
  async function save() {
    if (
      !ready ||
      inFlight.current ||
      stroke.current ||
      !document.current.title.trim() ||
      !canvas.current
    )
      return;
    const next = {
        ...document.current,
        body: canvas.current.toDataURL("image/png"),
      },
      version = generation.current;
    inFlight.current = true;
    setSaving(true);
    failed.current = false;
    try {
      const result: Drawing = await localJSON("/api/organizer/" + next.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      // A stroke or title edit can happen while the save request is in flight.
      const latest = { ...document.current, revision: result.revision };
      document.current = latest;
      if (generation.current === version) {
        localStorage.removeItem(draftKey);
        if (alive.current) {
          setDirty(false);
          setStatus("Saved on Pi");
        }
      } else recoverable(latest);
      if (alive.current) {
        setDrawing(latest);
        setSaved((items) => [
          result,
          ...items.filter((item) => item.id !== result.id),
        ]);
      }
    } catch (error) {
      failed.current = true;
      if (alive.current)
        setStatus(
          (error as Error).message +
            " Your changes are still here. Retry Save, Save a copy, or Export PNG.",
        );
    } finally {
      inFlight.current = false;
      if (alive.current) setSaving(false);
    }
  }
  async function load(item: Drawing) {
    const sequence = ++loadSequence.current;
    setReady(false);
    try {
      const image = item.body
        ? await new Promise<HTMLImageElement>((resolve, reject) => {
            const value = new Image();
            value.onload = () => resolve(value);
            value.onerror = () =>
              reject(new Error("Could not open this image."));
            value.src = item.body;
          })
        : null;
      if (!alive.current || sequence !== loadSequence.current) return false;
      const w = image?.width || 960,
        h = image?.height || 600;
      if (w > 1600 || h > 1200)
        throw new Error("This image exceeds the supported canvas size.");
      canvas.current!.width = w;
      canvas.current!.height = h;
      ctx().fillStyle = "#ffffff";
      ctx().fillRect(0, 0, w, h);
      if (image) ctx().drawImage(image, 0, 0);
      setDimensions({ w, h });
      updateDocument(item);
      undo.current = [];
      redo.current = [];
      setSelection(null);
      setDirty(false);
      failed.current = false;
      setStatus(item.revision ? "Saved on Pi" : "New drawing");
      return true;
    } catch (error) {
      if (alive.current && sequence === loadSequence.current)
        setStatus((error as Error).message);
      return false;
    } finally {
      if (alive.current && sequence === loadSequence.current) setReady(true);
    }
  }
  useEffect(() => {
    alive.current = true;
    if (isHostedDemo) return;
    void localJSON("/api/organizer?kind=drawing")
      .then((items: Drawing[]) => {
        if (alive.current) setSaved(items.filter((item) => !item.archived));
      })
      .catch((error: Error) => {
        if (alive.current) setStatus(error.message);
      });
    let recovered: Drawing | null = null;
    try {
      const value = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (
        value?.kind === "drawing" &&
        typeof value.title === "string" &&
        typeof value.body === "string" &&
        typeof value.id === "string" &&
        Number.isInteger(value.revision)
      )
        recovered = value;
    } catch {
      /* No valid recovery draft. */
    }
    void load(recovered || document.current).then((loaded) => {
      if (loaded && recovered && alive.current) {
        setDirty(true);
        setStatus("Recovered unsaved drawing");
      }
    });
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!ready || !dirty || saving || failed.current || !drawing.title.trim())
      return;
    const timer = window.setTimeout(() => void save(), 1000);
    return () => clearTimeout(timer);
  }, [drawing, dirty, saving, ready]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function point(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(
          event.currentTarget.width - 1,
          ((event.clientX - rect.left) * event.currentTarget.width) /
            rect.width,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          event.currentTarget.height - 1,
          ((event.clientY - rect.top) * event.currentTarget.height) /
            rect.height,
        ),
      ),
    };
  }
  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!ready || stroke.current || (event.button !== 0 && event.button !== 2))
      return;
    event.preventDefault();
    workspace.current?.focus({ preventScroll: true });
    const p = point(event),
      context = ctx(),
      color = event.button === 2 ? background : foreground;
    if (tool === "picker") {
      const pixel = context.getImageData(
        Math.floor(p.x),
        Math.floor(p.y),
        1,
        1,
      ).data;
      const value =
        "#" +
        Array.from(pixel.slice(0, 3))
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("");
      if (event.button === 2) setBackground(value);
      else setForeground(value);
      return;
    }
    const base = snapshot();
    if (tool === "fill") {
      const pixels = snapshot(),
        rgb = [1, 3, 5].map((offset) =>
          parseInt(color.slice(offset, offset + 2), 16),
        );
      if (
        floodFill(pixels.data, pixels.width, pixels.height, p.x, p.y, [
          ...rgb,
          255,
        ])
      ) {
        context.putImageData(pixels, 0, 0);
        checkpoint(base);
      }
      return;
    }
    if (tool === "text") {
      if (!text.trim()) {
        setStatus("Enter your text above, then click where it should appear.");
        return;
      }
      context.fillStyle = color;
      context.font = `${fontSize}px "IBM Plex Mono", monospace`;
      context.textBaseline = "top";
      text
        .split("\n")
        .forEach((line, index) =>
          context.fillText(line, p.x, p.y + index * fontSize * 1.25),
        );
      checkpoint(base);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    stroke.current = {
      start: p,
      last: p,
      base,
      pointer: event.pointerId,
      color,
    };
    if (tool === "select") {
      if (
        selection &&
        p.x >= selection.x &&
        p.x < selection.x + selection.w &&
        p.y >= selection.y &&
        p.y < selection.y + selection.h
      ) {
        const pixels = window.document.createElement("canvas");
        pixels.width = selection.w;
        pixels.height = selection.h;
        pixels
          .getContext("2d")!
          .putImageData(
            context.getImageData(
              selection.x,
              selection.y,
              selection.w,
              selection.h,
            ),
            0,
            0,
          );
        stroke.current.moving = selection;
        stroke.current.pixels = pixels;
      } else setSelection(null);
    } else {
      setSelection(null);
      if (["pencil", "brush", "eraser"].includes(tool))
        drawSegment(p, p, color);
    }
  }
  function drawSegment(from: Point, to: Point, color: string) {
    const context = ctx(),
      width = tool === "pencil" ? 1 : size;
    context.strokeStyle = context.fillStyle =
      tool === "eraser" ? background : color;
    context.lineWidth = width;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    if (from.x === to.x && from.y === to.y) {
      context.beginPath();
      context.arc(to.x, to.y, width / 2, 0, Math.PI * 2);
      context.fill();
    }
  }
  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    const p = point(event);
    setPosition(p);
    const active = stroke.current;
    if (!active || active.pointer !== event.pointerId) return;
    const context = ctx(),
      start = active.start;
    if (["pencil", "brush", "eraser"].includes(tool)) {
      drawSegment(active.last, p, active.color);
      active.last = p;
      return;
    }
    if (event.shiftKey && tool !== "select") {
      const dx = p.x - start.x,
        dy = p.y - start.y;
      if (tool === "line") {
        const angle =
            (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI) / 4,
          length = Math.hypot(dx, dy);
        p.x = start.x + Math.cos(angle) * length;
        p.y = start.y + Math.sin(angle) * length;
      } else {
        const side = Math.max(Math.abs(dx), Math.abs(dy));
        p.x = start.x + Math.sign(dx || 1) * side;
        p.y = start.y + Math.sign(dy || 1) * side;
      }
    }
    context.putImageData(active.base, 0, 0);
    if (tool === "select") {
      if (active.moving && active.pixels) {
        const old = active.moving,
          x = Math.max(
            0,
            Math.min(dimensions.w - old.w, Math.round(old.x + p.x - start.x)),
          ),
          y = Math.max(
            0,
            Math.min(dimensions.h - old.h, Math.round(old.y + p.y - start.y)),
          );
        context.fillStyle = background;
        context.fillRect(old.x, old.y, old.w, old.h);
        context.drawImage(active.pixels, x, y);
        setSelection({ ...old, x, y });
      } else
        setSelection({
          x: Math.floor(Math.min(start.x, p.x)),
          y: Math.floor(Math.min(start.y, p.y)),
          w: Math.max(1, Math.floor(Math.abs(p.x - start.x))),
          h: Math.max(1, Math.floor(Math.abs(p.y - start.y))),
        });
      return;
    }
    context.strokeStyle = active.color;
    context.fillStyle = fillStyle === "both" ? background : active.color;
    context.lineWidth = size;
    context.lineCap = "round";
    context.beginPath();
    if (tool === "line") {
      context.moveTo(start.x, start.y);
      context.lineTo(p.x, p.y);
    }
    if (tool === "rectangle")
      context.rect(start.x, start.y, p.x - start.x, p.y - start.y);
    if (tool === "ellipse")
      context.ellipse(
        (p.x + start.x) / 2,
        (p.y + start.y) / 2,
        Math.abs(p.x - start.x) / 2,
        Math.abs(p.y - start.y) / 2,
        0,
        0,
        Math.PI * 2,
      );
    if (tool !== "line" && fillStyle !== "outline") context.fill();
    if (tool === "line" || fillStyle !== "solid") context.stroke();
  }
  function finish(cancel = false) {
    const active = stroke.current;
    if (!active) return;
    stroke.current = null;
    if (cancel) {
      restore(active.base);
      setSelection(active.moving || null);
      if (dirty) changed();
      return;
    }
    if (tool !== "select" || active.moving) checkpoint(active.base);
  }
  function history(back: boolean) {
    if (stroke.current || !ready) return;
    const from = back ? undo.current : redo.current,
      to = back ? redo.current : undo.current;
    const image = from.pop();
    if (!image) return;
    to.push(snapshot());
    restore(image);
    setSelection(null);
    refreshHistory((value) => value + 1);
    changed();
  }
  function transform(action: "crop" | "delete" | "flip" | "rotate" | "clear") {
    if (stroke.current || !ready) return;
    const before = snapshot(),
      context = ctx();
    if ((action === "crop" || action === "delete") && !selection) return;
    if (action === "crop")
      restore(
        context.getImageData(
          selection!.x,
          selection!.y,
          selection!.w,
          selection!.h,
        ),
      );
    if (action === "delete" || action === "clear") {
      const box =
        action === "delete" ? selection! : { x: 0, y: 0, ...dimensions };
      context.fillStyle = background;
      context.fillRect(box.x, box.y, box.w, box.h);
    }
    if (action === "flip" || action === "rotate") {
      if (action === "rotate" && dimensions.w > 1200) {
        setStatus("Rotate supports images up to 1200 pixels wide.");
        return;
      }
      const copy = window.document.createElement("canvas");
      copy.width = dimensions.w;
      copy.height = dimensions.h;
      copy.getContext("2d")!.putImageData(before, 0, 0);
      if (action === "rotate") {
        canvas.current!.width = dimensions.h;
        canvas.current!.height = dimensions.w;
        setDimensions({ w: dimensions.h, h: dimensions.w });
        context.translate(dimensions.h, 0);
        context.rotate(Math.PI / 2);
      } else {
        context.translate(dimensions.w, 0);
        context.scale(-1, 1);
      }
      context.drawImage(copy, 0, 0);
      context.setTransform(1, 0, 0, 1, 0, 0);
    }
    setSelection(null);
    checkpoint(before);
  }
  async function importImage(file?: File) {
    if (!file || dirty || inFlight.current) return;
    if (
      !["image/png", "image/jpeg", "image/webp", "image/bmp"].includes(
        file.type,
      ) ||
      file.size > 12 * 1024 * 1024
    ) {
      setStatus("Choose a PNG, JPEG, WebP or BMP image under 12 MB.");
      return;
    }
    setReady(false);
    try {
      const image = await createImageBitmap(file);
      if (!alive.current) {
        image.close();
        return;
      }
      const scale = Math.min(1, 1600 / image.width, 1200 / image.height),
        w = Math.max(1, Math.round(image.width * scale)),
        h = Math.max(1, Math.round(image.height * scale));
      canvas.current!.width = w;
      canvas.current!.height = h;
      ctx().fillStyle = background;
      ctx().fillRect(0, 0, w, h);
      ctx().drawImage(image, 0, 0, w, h);
      image.close();
      setDimensions({ w, h });
      updateDocument({
        ...fresh(),
        title:
          file.name.replace(/\.[^.]+$/, "").slice(0, 200) || "Imported drawing",
      });
      undo.current = [];
      redo.current = [];
      setSelection(null);
      changed();
    } catch {
      setStatus("Could not read this image.");
    } finally {
      if (alive.current) setReady(true);
    }
  }
  function exportPNG() {
    canvas.current!.toBlob((blob) => {
      if (!blob) {
        setStatus("Could not export the image.");
        return;
      }
      const url = URL.createObjectURL(blob),
        link = window.document.createElement("a");
      link.href = url;
      link.download =
        (document.current.title.replace(/[^\w -]/g, "").slice(0, 80) ||
          "drawing") + ".png";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }
  function keyDown(event: React.KeyboardEvent) {
    if ((event.target as HTMLElement).closest("input, textarea, select"))
      return;
    const key = event.key.toLowerCase(),
      command = event.ctrlKey || event.metaKey;
    if (command && ["z", "y", "s"].includes(key)) {
      event.preventDefault();
      if (key === "s") void save();
      else history(key === "z" && !event.shiftKey);
      return;
    }
    if (command || event.altKey || stroke.current) return;
    if (key === "delete") {
      event.preventDefault();
      transform("delete");
    } else if (key === "escape") setSelection(null);
    else {
      const next = tools.find((value) => value.key.toLowerCase() === key);
      if (next) {
        event.preventDefault();
        setTool(next.id);
        setSelection(null);
      }
    }
  }
  if (isHostedDemo) return <p>Open the local Pi app to paint.</p>;
  const busy = saving || dirty || !ready;
  return (
    <section className="paint" aria-label="Paint workspace" onKeyDown={keyDown}>
      <div className="paint-document-bar">
        <label className="paint-name">
          DRAWING{" "}
          <input
            aria-label="Drawing name"
            value={drawing.title}
            maxLength={200}
            onChange={(event) => {
              updateDocument({
                ...document.current,
                title: event.target.value,
              });
              changed();
            }}
            disabled={!ready}
          />
        </label>
        <span className="paint-save-status" role="status">
          {saving ? "Saving on Pi…" : status}
        </span>
      </div>
      <div className="paint-command-bar">
        <button disabled={busy} onClick={() => void load(fresh())}>
          <Plus size={15} />
          New
        </button>
        <button disabled={busy} onClick={() => fileInput.current?.click()}>
          <FolderOpen size={15} />
          Import image
        </button>
        <input
          ref={fileInput}
          hidden
          type="file"
          accept="image/png,image/jpeg,image/webp,image/bmp"
          onChange={(event) => {
            void importImage(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <select
          aria-label="Open saved drawing"
          value=""
          disabled={busy}
          onChange={(event) => {
            const item = saved.find((value) => value.id === event.target.value);
            if (item) void load(item);
          }}
        >
          <option value="">Open saved…</option>
          {saved.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        <button
          disabled={saving || !ready || !drawing.title.trim()}
          onClick={() => void save()}
        >
          <Save size={15} />
          Save
        </button>
        {dirty && failed.current && (
          <button
            disabled={saving}
            onClick={() => {
              updateDocument({
                ...document.current,
                id: crypto.randomUUID(),
                revision: 0,
              });
              changed();
              void save();
            }}
          >
            Save a copy
          </button>
        )}
        <button disabled={!ready} onClick={exportPNG}>
          <Download size={15} />
          Export PNG
        </button>
        <span className="paint-divider" />
        <button
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
          disabled={!ready || !undo.current.length}
          onClick={() => history(true)}
        >
          <Undo2 size={17} />
        </button>
        <button
          aria-label="Redo"
          title="Redo (Ctrl+Y)"
          disabled={!ready || !redo.current.length}
          onClick={() => history(false)}
        >
          <Redo2 size={17} />
        </button>
      </div>
      <div className="paint-options">
        <strong>{tools.find((value) => value.id === tool)?.label}</strong>
        <label>
          Width{" "}
          <select
            value={size}
            onChange={(event) => setSize(Number(event.target.value))}
          >
            {[1, 2, 4, 8, 12, 20, 32, 48].map((value) => (
              <option key={value} value={value}>
                {value} px
              </option>
            ))}
          </select>
        </label>
        <label>
          Shape{" "}
          <select
            value={fillStyle}
            onChange={(event) => setFillStyle(event.target.value)}
          >
            <option value="outline">Outline</option>
            <option value="solid">Solid fill</option>
            <option value="both">Outline + background</option>
          </select>
        </label>
        {tool === "text" && (
          <>
            <label>
              Text{" "}
              <input
                value={text}
                maxLength={500}
                placeholder="Type, then click canvas"
                onChange={(event) => setText(event.target.value)}
              />
            </label>
            <label>
              Size{" "}
              <select
                value={fontSize}
                onChange={(event) => setFontSize(Number(event.target.value))}
              >
                {[14, 20, 28, 40, 56, 80].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          </>
        )}
        <button disabled={!selection} onClick={() => transform("crop")}>
          <Crop size={15} />
          Crop
        </button>
        <button disabled={!selection} onClick={() => transform("delete")}>
          <Trash2 size={15} />
          Delete selection
        </button>
        <button
          disabled={!ready}
          onClick={() => transform("flip")}
          title="Flip canvas horizontally"
        >
          <FlipHorizontal2 size={15} />
          Flip
        </button>
        <button disabled={!ready} onClick={() => transform("rotate")}>
          <RotateCw size={15} />
          Rotate
        </button>
        <button disabled={!ready} onClick={() => transform("clear")}>
          Clear
        </button>
      </div>
      <div className="paint-editor">
        <div
          className="paint-toolbox"
          role="toolbar"
          aria-label="Drawing tools"
        >
          {tools.map(({ id, label, key, icon: Icon }) => (
            <button
              key={id}
              title={`${label} (${key})`}
              aria-label={`${label} tool`}
              aria-pressed={tool === id}
              disabled={!ready}
              onClick={() => {
                setTool(id);
                setSelection(null);
              }}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div
          ref={workspace}
          className="paint-surface"
          tabIndex={0}
          aria-label="Canvas workspace"
        >
          <div
            className="paint-canvas-wrap"
            style={{
              width: zoom ? dimensions.w * zoom : "100%",
              maxWidth: zoom ? "none" : dimensions.w,
            }}
          >
            <canvas
              ref={canvas}
              width={960}
              height={600}
              aria-label="Drawing canvas"
              onContextMenu={(event) => event.preventDefault()}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={() => finish()}
              onPointerCancel={() => finish(true)}
              onLostPointerCapture={() => finish(true)}
              onPointerLeave={() => setPosition(null)}
            />
            {selection && (
              <div
                className="paint-selection"
                style={{
                  left: `${(selection.x / dimensions.w) * 100}%`,
                  top: `${(selection.y / dimensions.h) * 100}%`,
                  width: `${(selection.w / dimensions.w) * 100}%`,
                  height: `${(selection.h / dimensions.h) * 100}%`,
                }}
              />
            )}
          </div>
        </div>
      </div>
      <div className="paint-color-bar">
        <label>
          Foreground{" "}
          <input
            type="color"
            value={foreground}
            onChange={(event) => setForeground(event.target.value)}
          />
        </label>
        <button
          aria-label="Swap foreground and background"
          onClick={() => {
            setForeground(background);
            setBackground(foreground);
          }}
        >
          <ArrowLeftRight size={16} />
        </button>
        <label>
          Background{" "}
          <input
            type="color"
            value={background}
            onChange={(event) => setBackground(event.target.value)}
          />
        </label>
        <div className="paint-palette" aria-label="Color palette">
          {palette.map((value) => (
            <button
              key={value}
              aria-label={`Color ${value}`}
              aria-pressed={foreground === value}
              title={`${value} · Right-click sets background`}
              style={{ background: value }}
              onClick={() => setForeground(value)}
              onContextMenu={(event) => {
                event.preventDefault();
                setBackground(value);
              }}
            />
          ))}
        </div>
      </div>
      <div className="paint-footer">
        <span>
          {dimensions.w} × {dimensions.h} px
          {position
            ? ` · ${Math.floor(position.x)}, ${Math.floor(position.y)}`
            : ""}
          {selection ? ` · Selection ${selection.w} × ${selection.h}` : ""}
        </span>
        <label>
          Zoom{" "}
          <select
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          >
            <option value={0}>Fit</option>
            {[0.5, 1, 2, 4, 8].map((value) => (
              <option key={value} value={value}>
                {value * 100}%
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="organizer-caption">
        {hints[tool]} Ctrl+Z undo · Ctrl+Y redo · Ctrl+S save. Changes autosave
        on this Pi.
      </p>
    </section>
  );
}
