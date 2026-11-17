import { type ReactNode } from "react";
export function DetailsPanel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details
      className={`details-panel ${className}`}
      name="terminal-secondary-details"
    >
      <summary>{title}</summary>
      <div className="details-panel-content">{children}</div>
    </details>
  );
}
