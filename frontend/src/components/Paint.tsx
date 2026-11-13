import { useEffect, useRef, useState } from "react";
import { localJSON } from "./WikiReader";
import { isHostedDemo } from "../runtime";

type Drawing = { id: string; kind: "drawing"; title: string; body: string; revision: number; archived: boolean };
type Tool = "pencil" | "eraser" | "line" | "rectangle" | "ellipse";
const width = 960, height = 600;
export function Paint() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState<Drawing>({ id: crypto.randomUUID(), kind: "drawing", title: "Untitled drawing", body: "", revision: 0, archived: false });
  const [saved, setSaved] = useState<Drawing[]>([]);
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#242424");
  const [size, setSize] = useState(4);
  const [status, setStatus] = useState("Ready");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const undo = useRef<ImageData[]>([]);
  const redo = useRef<ImageData[]>([]);
  const stroke = useRef<{ x: number; y: number; base: ImageData } | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const draftKey = "klinekraft.paint.draft";
  function context() { return canvas.current!.getContext("2d")!; }
  function render(data: string, done?: () => void) {
    const ctx = context();
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height);
    if (!data) { done?.(); return; }
    const image = new Image();
    image.onload = () => { ctx.drawImage(image, 0, 0, width, height); done?.(); };
    image.onerror = () => { setStatus("Could not open the saved image."); done?.(); };
    image.src = data;
  }
  useEffect(() => {
    if (isHostedDemo) return;
    let active = true;
    void localJSON("/api/organizer?kind=drawing").then((items: Drawing[]) => { if (active) setSaved(items); })
      .catch((error: Error) => { if (active) setStatus(error.message); });
    let recovered: Drawing | null = null;
    try { recovered = JSON.parse(localStorage.getItem(draftKey) || "null"); } catch { /* Empty draft */ }
    if (recovered?.kind === "drawing" && typeof recovered.body === "string") {
      setDrawing(recovered); setDirty(true);
      render(recovered.body, () => setReady(true));
    } else render("", () => setReady(true));
    return () => { active = false; };
  }, []);
  function remember(next: Drawing) {
    setDrawing(next); setDirty(true);
    try { localStorage.setItem(draftKey, JSON.stringify(next)); setStatus("Unsaved changes"); }
    catch { setStatus("Browser recovery is full. Save this drawing on the Pi."); }
  }
  async function save() {
    if (!drawing.title.trim() || saving || stroke.current) return;
    setSaving(true);
    try {
      const next = { ...drawing, body: canvas.current!.toDataURL("image/png") };
      const result: Drawing = await localJSON("/api/organizer/" + drawing.id, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next),
      });
      setDrawing(result); setSaved((items) => [result, ...items.filter((item) => item.id !== result.id)]);
      setDirty(false); localStorage.removeItem(draftKey); setStatus("Saved on Pi.");
    } catch (error) { setDirty(false); setStatus((error as Error).message + " Use Save or Export PNG to keep your drawing."); }
    finally { setSaving(false); }
  }
  useEffect(() => {
    if (!ready || !dirty || saving || !drawing.title.trim()) return;
    const timer = window.setTimeout(() => void save(), 1000);
    return () => clearTimeout(timer);
  }, [drawing, dirty, saving, ready]);
  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * width / rect.width, y: (event.clientY - rect.top) * height / rect.height };
  }
  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    if (saving || !ready || stroke.current) return;
    setDirty(false);
    event.currentTarget.setPointerCapture(event.pointerId);
    const p = point(event), ctx = context();
    stroke.current = { ...p, base: ctx.getImageData(0, 0, width, height) };
    ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = size; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    if (tool === "pencil" || tool === "eraser") {
      ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
    }
  }
  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    const initial = stroke.current; if (!initial) return;
    const p = point(event), ctx = context();
    if (tool === "pencil" || tool === "eraser") { ctx.lineTo(p.x, p.y); ctx.stroke(); return; }
    ctx.putImageData(initial.base, 0, 0); ctx.beginPath();
    if (tool === "line") { ctx.moveTo(initial.x, initial.y); ctx.lineTo(p.x, p.y); }
    if (tool === "rectangle") ctx.rect(initial.x, initial.y, p.x - initial.x, p.y - initial.y);
    if (tool === "ellipse") ctx.ellipse((p.x + initial.x) / 2, (p.y + initial.y) / 2, Math.abs(p.x - initial.x) / 2, Math.abs(p.y - initial.y) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  function finish() {
    if (!stroke.current) return;
    undo.current = [...undo.current.slice(-14), stroke.current.base]; redo.current = [];
    stroke.current = null; setHistoryVersion((value) => value + 1);
    remember({ ...drawing, body: canvas.current!.toDataURL("image/png") });
  }
  function history(back: boolean) {
    const from = back ? undo.current : redo.current;
    const to = back ? redo.current : undo.current;
    const image = from.pop(); if (!image) return;
    to.push(context().getImageData(0, 0, width, height));
    context().putImageData(image, 0, 0);
    setHistoryVersion(historyVersion + 1); remember({ ...drawing, body: canvas.current!.toDataURL("image/png") });
  }
  function open(item: Drawing) {
    setReady(false); setDrawing(item); setDirty(false); undo.current = []; redo.current = [];
    render(item.body, () => setReady(true)); setStatus(item.revision ? "Saved on Pi." : "New drawing");
  }
  function exportPNG() {
    canvas.current!.toBlob((blob) => {
      if (!blob) { setStatus("Could not export the image."); return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url;
      link.download = (drawing.title.replace(/[^\w -]/g, "").slice(0, 80) || "drawing") + ".png";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }
  if (isHostedDemo) return <p>Open the local Pi app to paint.</p>;
  return <section className="paint" aria-label="Paint workspace">
    <div className="organizer-toolbar">
      <label>Drawing name <input value={drawing.title} maxLength={200} disabled={saving}
        onChange={(event) => remember({ ...drawing, title: event.target.value })} /></label>
      <button disabled={saving || dirty} onClick={() => open({ id: crypto.randomUUID(), kind: "drawing", title: "Untitled drawing", body: "", revision: 0, archived: false })}>New drawing</button>
      <label>Open saved <select value="" disabled={saving || dirty} onChange={(event) => {
        const item = saved.find((value) => value.id === event.target.value); if (item) open(item);
      }}><option value="">Choose drawing</option>{saved.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <button disabled={saving || !ready || !drawing.title.trim()} onClick={() => void save()}>Save</button>
      <button disabled={!ready} onClick={exportPNG}>Export PNG</button>
    </div>
    <div className="paint-tools">
      {(["pencil", "eraser", "line", "rectangle", "ellipse"] as Tool[]).map((value) =>
        <button key={value} aria-pressed={tool === value} onClick={() => setTool(value)}>{value}</button>)}
      <label>Color <input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
      <label>Width <input type="range" min={1} max={40} value={size} onChange={(event) => setSize(Number(event.target.value))} /></label>
      <button disabled={saving || !undo.current.length} onClick={() => history(true)}>Undo</button>
      <button disabled={saving || !redo.current.length} onClick={() => history(false)}>Redo</button>
    </div>
    <div className="paint-palette">{["#242424","#ffffff","#ff6a00","#003da5","#c43030","#258149","#f0ca37","#7952a3"].map((value) =>
      <button key={value} aria-label={`Color ${value}`} aria-pressed={color === value} style={{ background: value }} onClick={() => setColor(value)} />)}</div>
    <p role="status">{saving ? "Saving on Pi…" : status}</p>
    <div className="paint-surface"><canvas ref={canvas} width={width} height={height} aria-label="Drawing canvas"
      onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} /></div>
    <p className="organizer-caption">960 × 600 · Draw with mouse, touch or pen · Changes save automatically</p>
  </section>;
}
