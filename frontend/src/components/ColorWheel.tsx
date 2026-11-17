import { useEffect, useRef, useState } from "react";
export function ColorWheel({
  color,
  onChange,
  recent,
}: {
  color: string;
  onChange: (color: string) => void;
  recent: string[];
}) {
  const [history, setHistory] = useState(false);
  const wheel = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({left: 0, top: 0});
  function showHistory(open: boolean) {
    const rect = wheel.current?.getBoundingClientRect();
    if (rect) setPosition({left: Math.max(4, Math.min(rect.right + 8, innerWidth - 240)), top: Math.min(rect.top, innerHeight - 50)});
    setHistory(open);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    held = useRef(false);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function pick(e: React.PointerEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect(),
      x = e.clientX - r.left - r.width / 2,
      y = e.clientY - r.top - r.height / 2;
    const h = ((Math.atan2(y, x) * 180) / Math.PI + 450) % 360,
      s = Math.min(1, Math.hypot(x, y) / (r.width / 2));
    const c = s,
      z = c * (1 - Math.abs(((h / 60) % 2) - 1)),
      m = 1 - c;
    const rgb =
      h < 60
        ? [c, z, 0]
        : h < 120
          ? [z, c, 0]
          : h < 180
            ? [0, c, z]
            : h < 240
              ? [0, z, c]
              : h < 300
                ? [z, 0, c]
                : [c, 0, z];
    onChange(
      "#" +
        rgb
          .map((v) =>
            Math.round((v + m) * 255)
              .toString(16)
              .padStart(2, "0"),
          )
          .join(""),
    );
  }
  return (
    <div className="color-wheel-control">
      <button
        ref={wheel}
        type="button"
        className="color-wheel"
        aria-label="Color wheel; hold for recent colors"
        title="Choose color · hold for recent colors"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          held.current = false;
          timer.current = setTimeout(() => {
            held.current = true;
            showHistory(true);
          }, 450);
        }}
        onPointerUp={(e) => {
          if (timer.current) clearTimeout(timer.current);
          if (!held.current) pick(e);
        }}
        onPointerCancel={() => {
          if (timer.current) clearTimeout(timer.current);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          showHistory(!history);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            showHistory(!history);
          }
        }}
      />
      <input
        aria-label="Foreground color"
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
      />
      {history && (
        <div className="recent-colors" style={{position: 'fixed', ...position, bottom: 'auto'}}>
          <button
            aria-label="Close recent colors"
            onClick={() => setHistory(false)}
          >
            ×
          </button>
          {recent.map((value) => (
            <button
              key={value}
              aria-label={`Recent ${value}`}
              style={{ background: value }}
              onClick={() => {
                onChange(value);
                setHistory(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
