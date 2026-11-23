import { ColorWheel } from "./ColorWheel";
import { Info } from "./Info";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Pencil,
  Paintbrush,
  Eraser,
  PaintBucket,
  Pipette,
  Slash,
  RectangleHorizontal,
  Circle,
  Type,
  Baseline,
  SquareDashed,
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
  Copy,
  Maximize2,
  Minimize2,
  ChevronDown,
  SquareX,
  Ellipsis,
} from "lucide-react";
import { localJSON } from "./WikiReader";
import { isHostedDemo } from "../runtime";
import { drawBrush, type BrushKind } from "./paintBrushes";
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
  | "select"
  | "textpath";
const tools = [
  { id: "select", label: "Select", key: "S", icon: SquareDashed },
  { id: "pencil", label: "Pencil", key: "P", icon: Pencil },
  { id: "brush", label: "Brush", key: "B", icon: Paintbrush },
  { id: "eraser", label: "Eraser", key: "E", icon: Eraser },
  { id: "fill", label: "Fill", key: "F", icon: PaintBucket },
  { id: "picker", label: "Pick color", key: "I", icon: Pipette },
  { id: "line", label: "Line", key: "L", icon: Slash },
  { id: "rectangle", label: "Rectangle", key: "R", icon: RectangleHorizontal },
  { id: "ellipse", label: "Ellipse", key: "O", icon: Circle },
  { id: "text", label: "Text", key: "T", icon: Type },
  { id: "textpath", label: "Text on line", key: "A", icon: Baseline },
] as const;
// Tools whose right-drag paints with the background color, as in classic Paint.
const secondaryTools: readonly Tool[] = [
  "pencil",
  "brush",
  "line",
  "rectangle",
  "ellipse",
];
// Eight everyday colors stay one tap away at full touch size; the lighter
// and in-between shades live in the "More colors" popover.
const palette = [
  "#242424",
  "#ffffff",
  "#b52c36",
  "#ff6a00",
  "#f0ca37",
  "#258149",
  "#003da5",
  "#7952a3",
];
const morePalette = [
  "#777777",
  "#d1d1c8",
  "#e78086",
  "#c57b22",
  "#8fc47a",
  "#167c86",
  "#73cbd0",
  "#bb95d9",
];
// Only one Paint popover is open at a time.
type Popover = "context" | "file" | "canvas" | "recent" | "colors";
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
  textpath:
    "Enter text, then drag its baseline. Text is painted into the image.",
  select:
    "Drag to select. Drag inside to move. Crop or Delete to edit the selection.",
  pencil: "Draw a fine line. Right-drag draws in the background color.",
  brush: "Draw freehand. Right-drag paints in the background color.",
  eraser: "Erase to the background color.",
  fill: "Click to fill a connected area with the selected color.",
  picker: "Click the canvas to sample a color.",
  line: "Drag a line. Shift snaps the angle; right-drag uses the background color.",
  rectangle:
    "Drag a rectangle. Shift makes a square; right-drag swaps the two colors.",
  ellipse:
    "Drag an ellipse. Shift makes a circle; right-drag swaps the two colors.",
  text: "Enter text above, then click the canvas to place it.",
};

export function Paint({ beforeLeave }: { beforeLeave?: { current: (() => Promise<boolean>) | null } }) {
  const [mirror, setMirror] = useState("off");
  const [recent, setRecent] = useState<string[]>([
    "#242424",
    "#ffffff",
    "#123aff",
  ]);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [popover, setPopoverState] = useState<Popover | null>(null);
  const openPopover = useRef<Popover | null>(null);
  const root = useRef<HTMLElement>(null);
  function setPopover(next: Popover | null) {
    openPopover.current = next;
    setPopoverState(next);
    // The shared help popover manages itself; opening anything else closes it.
    if (next)
      root.current
        ?.querySelector(".paint-help details[open]")
        ?.removeAttribute("open");
  }
  const togglePopover = (next: Popover) =>
    setPopover(openPopover.current === next ? null : next);
  const contextMenu = popover === "context" ? menuAt : null;
  useEffect(() => {
    if (!popover) return;
    // Escape and any press outside the open popover (and its trigger) close
    // it. The capture-phase Escape runs before the workspace and expanded
    // view handlers so one press closes only the popover.
    const outside = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest?.(`[data-paint-popover="${popover}"]`))
        setPopover(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      const trigger = root.current?.querySelector<HTMLElement>(
        `[data-paint-popover="${popover}"] [data-paint-trigger]`,
      );
      setPopover(null);
      if (
        trigger &&
        root.current?.contains(window.document.activeElement) &&
        popover !== "context"
      )
        trigger.focus();
    };
    window.document.addEventListener("pointerdown", outside);
    window.addEventListener("keydown", escape, true);
    return () => {
      window.document.removeEventListener("pointerdown", outside);
      window.removeEventListener("keydown", escape, true);
    };
  }, [popover]);
  const [expanded, setExpanded] = useState(false);
  const [brush, setBrush] = useState<BrushKind>("round");
  useEffect(() => {
    const changed = () => {
      if (!window.document.fullscreenElement) setExpanded(false);
    };
    window.document.addEventListener("fullscreenchange", changed);
    return () =>
      window.document.removeEventListener("fullscreenchange", changed);
  }, []);
  useEffect(() => {
    if (!expanded) return;
    const previous = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !window.document.fullscreenElement)
        setExpanded(false);
    };
    window.addEventListener("keydown", escape);
    return () => {
      window.document.body.style.overflow = previous;
      window.removeEventListener("keydown", escape);
    };
  }, [expanded]);
  function toggleFullscreen() {
    setExpanded((value) => !value);
  }
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
  const [fitWidth, setFitWidth] = useState<number | null>(null);
  useEffect(() => {
    const surface = workspace.current;
    if (!surface) return;
    const measure = () => {
      const style = getComputedStyle(surface);
      const width =
        surface.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight);
      const height =
        surface.clientHeight -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom);
      setFitWidth(
        Math.max(
          1,
          Math.min(dimensions.w, width, (height * dimensions.w) / dimensions.h),
        ),
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(surface);
    measure();
    return () => observer.disconnect();
  }, [dimensions.w, dimensions.h, expanded]);

  const [text, setText] = useState(""),
    [fontSize, setFontSize] = useState(28);
  // A one-off prompt shown in the hint row in place of the tool hint; it
  // belongs to the current tool and text, so changing either clears it
  // (see chooseTool and the Text field).
  const [notice, setNotice] = useState("");
  function chooseTool(next: Tool) {
    setTool(next);
    setSelection(null);
    setNotice("");
  }
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
    fill: string;
    moved: boolean;
    moving?: Box;
    pixels?: HTMLCanvasElement;
  } | null>(null);
  // A right press that has not moved yet: released in place it opens the menu.
  const rightPress = useRef<Point | null>(null),
    contextHandledUntil = useRef(0);
  const loadSequence = useRef(0);
  const unsaved = useRef(false);
  const pendingSave = useRef<Promise<Drawing> | null>(null);
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
    unsaved.current = true;
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
      pendingSave.current = localJSON("/api/organizer/" + next.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const result = await pendingSave.current;
      // A stroke or title edit can happen while the save request is in flight.
      const latest = { ...document.current, revision: result.revision };
      document.current = latest;
      if (generation.current === version) {
        unsaved.current = false;
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
      pendingSave.current = null;
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
      unsaved.current = false;
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
        unsaved.current = true;
        setDirty(true);
        setStatus("Recovered unsaved drawing");
      }
    });
    return () => {
      alive.current = false;
    };
  }, []);
  useLayoutEffect(() => {
    if (!beforeLeave) return;
    const guard = async () => {
      if (!unsaved.current) return true;
      if (stroke.current) {
        setStatus("Finish the stroke before switching pages.");
        return false;
      }
      if (pendingSave.current) {
        try { await pendingSave.current; } catch { return false; }
        if (!unsaved.current) return true;
      }
      if (!document.current.title.trim()) {
        setStatus("Name this drawing before leaving Paint.");
        return false;
      }
      await save();
      return !unsaved.current;
    };
    beforeLeave.current = guard;
    return () => { if (beforeLeave.current === guard) beforeLeave.current = null; };
  });
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
  function openMenu(x: number, y: number) {
    setMenuAt({
      x: Math.max(4, Math.min(x, window.innerWidth - 220)),
      y: Math.max(4, Math.min(y, window.innerHeight - 240)),
    });
    setPopover("context");
  }
  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const secondary = event.button === 2;
    if (openPopover.current) {
      setPopover(null);
      // A tap that dismisses a menu must not also paint a dot.
      if (!secondary) return;
    }
    if (secondary) {
      rightPress.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
      // Other tools keep right-click for the canvas menu only.
      if (!secondaryTools.includes(tool)) return;
    } else if (event.button !== 0) return;
    if (!ready || stroke.current) return;
    event.preventDefault();
    workspace.current?.focus({ preventScroll: true });
    const p = point(event),
      context = ctx(),
      color = secondary ? background : foreground,
      fill = secondary ? foreground : background;
    if (!secondary && tool !== "eraser" && tool !== "select")
      setRecent((old) => [color, ...old.filter((c) => c !== color)].slice(0, 6));
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
      setForeground(value);
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
        setNotice("Type your text in the Text field first, then click where it should appear.");
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
    if (tool === "textpath" && !text.trim()) {
      setNotice("Type your text in the Text field first, then drag its baseline.");
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    stroke.current = {
      start: p,
      last: p,
      base,
      pointer: event.pointerId,
      color,
      fill,
      moved: false,
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
    const draw = (a: Point, b: Point) =>
      drawBrush(
        ctx(),
        a,
        b,
        tool === "pencil" ? 1 : size,
        tool === "eraser" ? background : color,
        tool === "brush" ? brush : "round",
      );
    draw(from, to);
    if (mirror === "vertical" || mirror === "both")
      draw(
        { x: dimensions.w - 1 - from.x, y: from.y },
        { x: dimensions.w - 1 - to.x, y: to.y },
      );
    if (mirror === "horizontal" || mirror === "both")
      draw(
        { x: from.x, y: dimensions.h - 1 - from.y },
        { x: to.x, y: dimensions.h - 1 - to.y },
      );
    if (mirror === "both")
      draw(
        { x: dimensions.w - 1 - from.x, y: dimensions.h - 1 - from.y },
        { x: dimensions.w - 1 - to.x, y: dimensions.h - 1 - to.y },
      );
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    const p = point(event);
    setPosition(p);
    const active = stroke.current;
    if (!active || active.pointer !== event.pointerId) return;
    const context = ctx(),
      start = active.start;
    if (Math.hypot(p.x - start.x, p.y - start.y) >= 1) active.moved = true;
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
    if (tool === "textpath") {
      context.save();
      context.translate(start.x, start.y);
      context.rotate(Math.atan2(p.y - start.y, p.x - start.x));
      context.font = `${fontSize}px "IBM Plex Mono", monospace`;
      context.fillStyle = active.color;
      context.textBaseline = "bottom";
      context.fillText(
        text,
        0,
        0,
        Math.max(1, Math.hypot(p.x - start.x, p.y - start.y)),
      );
      context.restore();
      return;
    }
    context.strokeStyle = active.color;
    context.fillStyle = fillStyle === "both" ? active.fill : active.color;
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
    if (cancel) rightPress.current = null;
    const active = stroke.current;
    if (!active) return;
    stroke.current = null;
    if (cancel) {
      restore(active.base);
      setSelection(active.moving || null);
      if (dirty) changed();
      return;
    }
    // A click that drew nothing (no drag for a shape, a selection left in
    // place) must not cost an undo step or an autosave.
    if (tool === "select" && !active.moving) return;
    if (
      ["select", "line", "rectangle", "ellipse", "textpath"].includes(tool) &&
      !active.moved
    ) {
      ctx().putImageData(active.base, 0, 0);
      if (active.moving) setSelection(active.moving);
      return;
    }
    checkpoint(active.base);
  }
  function release(event: React.PointerEvent<HTMLCanvasElement>) {
    const press = rightPress.current;
    if (event.button === 2 && press) {
      rightPress.current = null;
      contextHandledUntil.current = performance.now() + 600;
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < 4) {
        // A right-click, not a right-drag: undo the dot and open the menu.
        const active = stroke.current;
        stroke.current = null;
        if (active) ctx().putImageData(active.base, 0, 0);
        openMenu(event.clientX, event.clientY);
        return;
      }
    }
    finish();
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
  function duplicateSelection() {
    if (!selection || !ready) return;
    const before = snapshot(),
      box = selection;
    const pixels = ctx().getImageData(box.x, box.y, box.w, box.h);
    const x = Math.min(dimensions.w - box.w, box.x + 20),
      y = Math.min(dimensions.h - box.h, box.y + 20);
    ctx().putImageData(pixels, x, y);
    setSelection({ ...box, x, y });
    checkpoint(before);
  }
  function transform(action: "crop" | "delete" | "flip" | "rotate" | "clear") {
    if (stroke.current || !ready) return;
    const before = snapshot(),
      context = ctx();
    if ((action === "crop" || action === "delete") && !selection) return;
    if (selection && (action === "flip" || action === "rotate")) {
      const box = selection,
        copy = window.document.createElement("canvas");
      copy.width = box.w;
      copy.height = box.h;
      copy
        .getContext("2d")!
        .putImageData(context.getImageData(box.x, box.y, box.w, box.h), 0, 0);
      const w = action === "rotate" ? box.h : box.w,
        h = action === "rotate" ? box.w : box.h;
      if (w > dimensions.w || h > dimensions.h) {
        setStatus("Selection does not fit when rotated.");
        return;
      }
      const x = Math.min(box.x, dimensions.w - w),
        y = Math.min(box.y, dimensions.h - h);
      context.fillStyle = background;
      context.fillRect(box.x, box.y, box.w, box.h);
      context.save();
      if (action === "rotate") {
        context.translate(x + w, y);
        context.rotate(Math.PI / 2);
      } else {
        context.translate(x + w, y);
        context.scale(-1, 1);
      }
      context.drawImage(copy, 0, 0);
      context.restore();
      setSelection({ x, y, w, h });
      checkpoint(before);
      return;
    }
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
        chooseTool(next.id);
      }
    }
  }
  if (isHostedDemo) return <p>Open the local Pi app to paint.</p>;
  const busy = saving || dirty || !ready;
  const hasWidth = ["brush", "eraser", "line", "rectangle", "ellipse"].includes(
    tool,
  );
  const mirrors = ["pencil", "brush", "eraser"].includes(tool);
  const closeMenu = (_event?: React.SyntheticEvent) => setPopover(null);
  const menu = (id: "file" | "canvas", label: string) => ({
    wrapper: { className: "paint-menu", "data-paint-popover": id },
    trigger: {
      type: "button" as const,
      className: "k-btn paint-menu-trigger",
      "data-paint-trigger": "",
      "aria-expanded": popover === id,
      "aria-controls": `paint-${id}-menu`,
      onClick: () => togglePopover(id),
      children: (
        <>
          {label} <ChevronDown size={16} aria-hidden />
        </>
      ),
    },
    panel: {
      id: `paint-${id}-menu`,
      className: "paint-menu-panel",
      role: "group",
      "aria-label": `${label} menu`,
    },
  });
  const swatch = (value: string, close = false) => (
    <button
      key={value}
      type="button"
      className="paint-color"
      aria-label={`Color ${value}`}
      aria-pressed={foreground === value}
      title={`${value} · click: foreground · right-click: background`}
      style={{ background: value }}
      onClick={() => {
        setForeground(value);
        if (close) closeMenu();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        setBackground(value);
        if (close) closeMenu();
      }}
    />
  );
  const fileMenu = menu("file", "File"),
    canvasMenu = menu("canvas", "Canvas");
  return (
    <section
      ref={root}
      className={`paint${expanded ? " paint-expanded" : ""}`}
      aria-label="Paint workspace"
      onKeyDown={keyDown}
    >
      <div className="paint-bar">
        <button
          type="button"
          className="k-btn k-btn--icon"
          onClick={() => void toggleFullscreen()}
          aria-label={
            expanded ? "Exit expanded Paint" : "Expand Paint workspace"
          }
          title={expanded ? "Exit expanded Paint (Esc)" : "Expand Paint"}
        >
          {expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
        <input
          className="k-field paint-title"
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
        <span className="paint-save-status" role="status">
          {saving ? "Saving on Pi…" : status}
        </span>
        <div className="paint-group" role="group" aria-label="History">
          <button
            type="button"
            className="k-btn k-btn--icon k-btn--quiet"
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            disabled={!ready || !undo.current.length}
            onClick={() => history(true)}
          >
            <Undo2 size={18} />
          </button>
          <button
            type="button"
            className="k-btn k-btn--icon k-btn--quiet"
            aria-label="Redo"
            title="Redo (Ctrl+Y)"
            disabled={!ready || !redo.current.length}
            onClick={() => history(false)}
          >
            <Redo2 size={18} />
          </button>
        </div>
        <div {...fileMenu.wrapper}>
          <button {...fileMenu.trigger} />
          {/* Kept mounted (hidden) so the file input survives closing. */}
          <div {...fileMenu.panel} hidden={popover !== "file"}>
            <button
              type="button"
              className="k-btn k-btn--quiet"
              disabled={busy}
              onClick={(event) => {
                closeMenu(event);
                void load(fresh());
              }}
            >
              <Plus size={16} />
              New drawing
            </button>
            <button
              type="button"
              className="k-btn k-btn--quiet"
              disabled={busy}
              onClick={(event) => {
                closeMenu(event);
                fileInput.current?.click();
              }}
            >
              <FolderOpen size={16} />
              Import image…
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
              className="k-select"
              aria-label="Open saved drawing"
              value=""
              disabled={busy || !saved.length}
              onChange={(event) => {
                const item = saved.find(
                  (value) => value.id === event.target.value,
                );
                closeMenu(event);
                if (item) void load(item);
              }}
            >
              <option value="">
                {saved.length ? "Open saved…" : "No saved drawings yet"}
              </option>
              {saved.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            {ready && dirty && (
              <p className="paint-menu-note">
                New, Import and Open unlock once this drawing is saved.
              </p>
            )}
            <hr />
            <button
              type="button"
              className="k-btn k-btn--quiet"
              disabled={saving || !ready || !drawing.title.trim()}
              onClick={(event) => {
                closeMenu(event);
                void save();
              }}
            >
              <Save size={16} />
              Save now
            </button>
            {dirty && failed.current && (
              <button
                type="button"
                className="k-btn k-btn--quiet"
                disabled={saving}
                onClick={(event) => {
                  closeMenu(event);
                  updateDocument({
                    ...document.current,
                    id: crypto.randomUUID(),
                    revision: 0,
                  });
                  changed();
                  void save();
                }}
              >
                <Copy size={16} />
                Save a copy
              </button>
            )}
            <button
              type="button"
              className="k-btn k-btn--quiet"
              disabled={!ready}
              onClick={(event) => {
                closeMenu(event);
                exportPNG();
              }}
            >
              <Download size={16} />
              Export PNG
            </button>
          </div>
        </div>
      </div>
      <div className="paint-options">
        {tool === "brush" && (
          <label>
            Brush
            <select
              className="k-select"
              value={brush}
              onChange={(event) => setBrush(event.target.value as BrushKind)}
            >
              <option value="round">Round</option>
              <option value="square">Square</option>
              <option value="chisel">Calligraphy</option>
              <option value="soft">Soft airbrush</option>
              <option value="spray">Spray</option>
            </select>
          </label>
        )}
        {hasWidth && (
          <label>
            Width
            <select
              className="k-select"
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
        )}
        {mirrors && (
          <label>
            Mirror
            <select
              className="k-select"
              aria-label="Mirror drawing"
              value={mirror}
              onChange={(e) => setMirror(e.target.value)}
            >
              <option value="off">Off</option>
              <option value="vertical">Left / right</option>
              <option value="horizontal">Top / bottom</option>
              <option value="both">Four way</option>
            </select>
          </label>
        )}
        {["rectangle", "ellipse"].includes(tool) && (
          <label>
            Shape
            <select
              className="k-select"
              value={fillStyle}
              onChange={(event) => setFillStyle(event.target.value)}
            >
              <option value="outline">Outline</option>
              <option value="solid">Solid fill</option>
              <option value="both">Outline + background</option>
            </select>
          </label>
        )}
        {["text", "textpath"].includes(tool) && (
          <>
            <label className="paint-text-option">
              Text
              <input
                className="k-field"
                value={text}
                maxLength={500}
                placeholder={
                  tool === "text"
                    ? "Type, then click the canvas"
                    : "Type, then drag a baseline"
                }
                onChange={(event) => {
                  setText(event.target.value);
                  setNotice("");
                }}
              />
            </label>
            <label>
              Size
              <select
                className="k-select"
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
        <p className={`paint-hint${notice ? " paint-hint--notice" : ""}`}>
          {notice || hints[tool]}
        </p>
        <div {...canvasMenu.wrapper}>
          <button {...canvasMenu.trigger} />
          <div {...canvasMenu.panel} hidden={popover !== "canvas"}>
            <button
              type="button"
              className="k-btn k-btn--quiet"
              disabled={!selection}
              onClick={(event) => {
                closeMenu(event);
                transform("crop");
              }}
            >
              <Crop size={16} />
              Crop to selection
            </button>
            <button
              type="button"
              className="k-btn k-btn--quiet"
              disabled={!selection}
              onClick={(event) => {
                closeMenu(event);
                transform("delete");
              }}
            >
              <Trash2 size={16} />
              Delete selection
            </button>
            <button
              type="button"
              className="k-btn k-btn--quiet"
              disabled={!selection}
              onClick={(event) => {
                closeMenu(event);
                duplicateSelection();
              }}
            >
              <Copy size={16} />
              Duplicate selection
            </button>
            <hr />
            <button
              type="button"
              className="k-btn k-btn--quiet"
              disabled={!ready}
              onClick={(event) => {
                closeMenu(event);
                transform("flip");
              }}
            >
              <FlipHorizontal2 size={16} />
              {selection ? "Flip selection" : "Flip canvas"}
            </button>
            <button
              type="button"
              className="k-btn k-btn--quiet"
              disabled={!ready}
              onClick={(event) => {
                closeMenu(event);
                transform("rotate");
              }}
            >
              <RotateCw size={16} />
              {selection ? "Rotate selection" : "Rotate canvas"}
            </button>
            <button
              type="button"
              className="k-btn k-btn--quiet"
              disabled={!ready}
              onClick={(event) => {
                closeMenu(event);
                transform("clear");
              }}
            >
              <SquareX size={16} />
              Clear canvas
            </button>
          </div>
        </div>
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
              type="button"
              className="k-btn k-btn--icon"
              title={`${label} (${key})`}
              aria-label={`${label} tool`}
              aria-pressed={tool === id}
              disabled={!ready}
              onClick={() => {
                chooseTool(id);
              }}
            >
              <Icon size={18} aria-hidden />
            </button>
          ))}
          <div
            className="paint-help"
            onClickCapture={() => setPopover(null)}
          >
            <Info label="Paint help">
              <p>
                <strong>
                  {tools.find((value) => value.id === tool)?.label}:
                </strong>{" "}
                {hints[tool]}
              </p>
              <p>
                Right-click or long-press the canvas for canvas actions. In
                the palette, click sets the foreground and right-click the
                background; ⋯ shows more colors.
              </p>
              <p>
                Ctrl+Z undo · Ctrl+Y redo · Ctrl+S save · Delete clears the
                selection. The letter in each tool tip selects that tool. PNG
                drawings flatten text and shapes.
              </p>
            </Info>
          </div>
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
              width: zoom ? dimensions.w * zoom : (fitWidth ?? "100%"),
              maxWidth: zoom ? "none" : dimensions.w,
            }}
          >
            <canvas
              ref={canvas}
              width={960}
              height={600}
              aria-label="Drawing canvas"
              onContextMenu={(event) => {
                event.preventDefault();
                // Mouse right-clicks are handled on release; this path serves
                // touch long-press and keyboard menu keys.
                if (
                  rightPress.current ||
                  performance.now() < contextHandledUntil.current
                )
                  return;
                openMenu(event.clientX, event.clientY);
              }}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={release}
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
      {contextMenu && (
        <div
          className="paint-context"
          data-paint-popover="context"
          role="menu"
          aria-label="Canvas actions"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            role="menuitem"
            className="k-btn k-btn--quiet"
            disabled={!selection}
            onClick={() => {
              transform("crop");
              setPopover(null);
            }}
          >
            <Crop size={16} />
            Crop selection
          </button>
          <button
            role="menuitem"
            className="k-btn k-btn--quiet"
            disabled={!selection}
            onClick={() => {
              transform("delete");
              setPopover(null);
            }}
          >
            <Trash2 size={16} />
            Delete selection
          </button>
          <button
            role="menuitem"
            className="k-btn k-btn--quiet"
            disabled={!selection}
            onClick={() => {
              duplicateSelection();
              setPopover(null);
            }}
          >
            <Copy size={16} />
            Duplicate selection
          </button>
          <button
            role="menuitem"
            className="k-btn k-btn--quiet"
            onClick={() => {
              transform("flip");
              setPopover(null);
            }}
          >
            <FlipHorizontal2 size={16} />
            {selection ? "Flip selection" : "Flip canvas"}
          </button>
          <button
            role="menuitem"
            className="k-btn k-btn--quiet"
            onClick={() => {
              transform("rotate");
              setPopover(null);
            }}
          >
            <RotateCw size={16} />
            {selection ? "Rotate selection" : "Rotate canvas"}
          </button>
          <button
            role="menuitem"
            className="k-btn k-btn--quiet"
            disabled={!undo.current.length}
            onClick={() => {
              history(true);
              setPopover(null);
            }}
          >
            <Undo2 size={16} />
            Undo
          </button>
        </div>
      )}
      <div className="paint-footer">
        <div className="paint-colors" role="group" aria-label="Colors">
          <input
            className="paint-swatch"
            aria-label="Foreground color"
            title="Foreground color (left click and drag)"
            type="color"
            value={foreground}
            onChange={(e) => setForeground(e.target.value)}
          />
          <button
            type="button"
            className="k-btn k-btn--icon k-btn--quiet"
            aria-label="Swap foreground and background colors"
            title="Swap colors"
            onClick={() => {
              setForeground(background);
              setBackground(foreground);
            }}
          >
            <ArrowLeftRight size={16} />
          </button>
          <input
            className="paint-swatch"
            aria-label="Background color"
            title="Background color (right drag, eraser, cleared areas)"
            type="color"
            value={background}
            onChange={(e) => setBackground(e.target.value)}
          />
          <div
            className="paint-palette"
            role="group"
            aria-label="Palette: click for foreground, right-click for background"
          >
            {palette.map((value) => swatch(value))}
            <div className="paint-more-colors" data-paint-popover="colors">
              <button
                type="button"
                className="k-btn k-btn--icon k-btn--quiet"
                data-paint-trigger=""
                aria-label="More colors"
                title="More colors"
                aria-expanded={popover === "colors"}
                aria-pressed={morePalette.includes(foreground)}
                onClick={() => togglePopover("colors")}
              >
                <Ellipsis size={18} aria-hidden />
              </button>
              {popover === "colors" && (
                <div
                  className="paint-more-panel"
                  role="group"
                  aria-label="More colors"
                >
                  {morePalette.map((value) => swatch(value, true))}
                </div>
              )}
            </div>
          </div>
          <ColorWheel
            color={foreground}
            onChange={setForeground}
            recent={recent}
            open={popover === "recent"}
            onOpenChange={(open) =>
              open ? setPopover("recent") : closeMenu()
            }
          />
        </div>
        <span className="paint-readout">
          {dimensions.w} × {dimensions.h}
          {position
            ? ` · ${Math.floor(position.x)}, ${Math.floor(position.y)}`
            : ""}
          {selection ? ` · selection ${selection.w} × ${selection.h}` : ""}
        </span>
        <label className="paint-zoom">
          Zoom
          <select
            className="k-select"
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
    </section>
  );
}
