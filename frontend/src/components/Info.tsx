import { useEffect, useRef, type ReactNode } from "react";
export function Info({
  children,
  label = "Information",
}: {
  children: ReactNode;
  label?: string;
}) {
  const panel = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (panel.current?.open && !panel.current.contains(event.target as Node))
        panel.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && panel.current?.open) {
        panel.current.open = false;
        panel.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <details ref={panel} className="info-popover" name="terminal-information">
      <summary aria-label={label} title={label}>
        i
      </summary>
      <div className="info-content">{children}</div>
    </details>
  );
}
