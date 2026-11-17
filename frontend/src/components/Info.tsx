import { type ReactNode } from "react";
export function Info({
  children,
  label = "Information",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <details className="info-popover">
      <summary aria-label={label} title={label}>
        i
      </summary>
      <div className="info-content">{children}</div>
    </details>
  );
}
