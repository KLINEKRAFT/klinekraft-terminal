import { useEffect, useRef, useState, type ReactNode } from "react";
export function LocalImage({
  src,
  alt = "",
  fallback,
}: {
  src: string;
  alt?: string;
  fallback?: ReactNode;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false),
    [url, setUrl] = useState("");
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" },
    );
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    let object = "";
    setUrl("");
    void fetch(src, {
      headers: { "X-Klinekraft-Client": "local-ui" },
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.blob();
      })
      .then((blob) => {
        if (!controller.signal.aborted) {
          object = URL.createObjectURL(blob);
          setUrl(object);
        }
      })
      .catch(() => {});
    return () => {
      controller.abort();
      if (object) URL.revokeObjectURL(object);
    };
  }, [src, visible]);
  return (
    <span ref={host} className="local-image">
      {url ? <img src={url} alt={alt} onError={() => setUrl("")} /> : fallback}
    </span>
  );
}
