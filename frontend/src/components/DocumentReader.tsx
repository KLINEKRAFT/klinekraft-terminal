import { useEffect, useId, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerURL from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export type DocumentSource = { url: string; title: string; mime?: string; page?: number | null };

export function DocumentReader({ source, onClose, onAsk }: {
  source: DocumentSource; onClose: () => void; onAsk?: (file: File) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const heading = useId();
  const [file, setFile] = useState<File | null>(null);
  const [pdf, setPDF] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(source.page || 1);
  const [text, setText] = useState("");
  const [imageURL, setImageURL] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { previous?.focus(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    let image = "";
    let task: ReturnType<typeof import("pdfjs-dist")["getDocument"]> | undefined;
    setLoading(true); setError(""); setPDF(null); setFile(null); setText("");
    void (async () => {
      try {
        const response = await fetch(source.url, {
          headers: { "X-Klinekraft-Client": "local-ui" }, cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("Could not open this document. Close the reader and try again.");
        const blob = await response.blob();
        if (disposed) return;
        const type = source.mime || blob.type.split(";")[0];
        setFile(new File([blob], source.title, { type }));
        if (type === "application/pdf") {
          const [library, data] = await Promise.all([import("pdfjs-dist"), blob.arrayBuffer()]);
          if (disposed) return;
          library.GlobalWorkerOptions.workerSrc = workerURL;
          task = library.getDocument({ data: new Uint8Array(data),
            cMapUrl: "/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdfjs/standard_fonts/",
            wasmUrl: "/pdfjs/wasm/", iccUrl: "/pdfjs/iccs/",
          });
          const document = await task.promise;
          if (disposed) return;
          setPage(Math.max(1, Math.min(source.page || 1, document.numPages)));
          setPDF(document);
        } else if (type.startsWith("image/")) {
          image = URL.createObjectURL(blob); setImageURL(image);
        } else if (type.startsWith("text/") || /\.(txt|md)$/i.test(source.title)) {
          const content = await blob.text();
          if (!disposed) setText(content);
        } else {
          throw new Error("This file type cannot be displayed in the reader.");
        }
      } catch (failure) {
        if (!disposed) setError(failure instanceof Error ? failure.message : "Could not read this document.");
      } finally { if (!disposed) setLoading(false); }
    })();
    return () => { disposed = true; controller.abort(); if (task) void task.destroy(); if (image) URL.revokeObjectURL(image); };
  }, [source]);

  useEffect(() => {
    if (!pdf) return;
    let disposed = false;
    let render: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | undefined;
    setRendering(true);
    void (async () => {
      try {
        const sheet = await pdf.getPage(page);
        if (disposed || !canvas.current) return;
        const base = sheet.getViewport({ scale: 1 });
        const viewport = sheet.getViewport({ scale: Math.min(2, 1800 / Math.max(base.width, base.height)) });
        const surface = canvas.current;
        surface.width = Math.ceil(viewport.width); surface.height = Math.ceil(viewport.height);
        render = sheet.render({ canvas: surface, viewport });
        await render.promise;
      } catch (failure) {
        if (!disposed) setError(failure instanceof Error ? failure.message : "Could not display this page.");
      } finally { if (!disposed) setRendering(false); }
    })();
    return () => { disposed = true; render?.cancel(); };
  }, [pdf, page]);

  return <dialog ref={dialog} className="document-reader" aria-labelledby={heading} onCancel={onClose}>
    <header>
      <h2 id={heading}>{source.title}</h2>
      <button type="button" onClick={onClose} autoFocus>Close reader</button>
      {onAsk && file && <button type="button" onClick={() => onAsk(file)}>Ask about this</button>}
    </header>
    {pdf && <nav aria-label="Document pages">
      <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous page</button>
      <span>Page {page} of {pdf.numPages}</span>
      <button type="button" disabled={page >= pdf.numPages} onClick={() => setPage(p => p + 1)}>Next page</button>
    </nav>}
    {(loading || rendering) && <p role="status">{loading ? "Opening document…" : "Drawing page…"}</p>}
    {error && <p role="alert">{error}</p>}
    <div className="document-reader-body">
      {pdf && <canvas key={page} ref={canvas} role="img" aria-label={`Page ${page} of ${source.title}`} />}
      {text && <pre>{text}</pre>}
      {imageURL && <img src={imageURL} alt={source.title} />}
    </div>
  </dialog>;
}
