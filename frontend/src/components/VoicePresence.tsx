import { useEffect, useRef } from "react";

export type VoicePhase = "idle" | "muted" | "listening" | "thinking" | "preparing" | "speaking" | "followup" | "error";
export function VoicePresence({ style = "hologram", phase, level = 0, preview = false }: {
  style?: "hologram" | "liquid"; phase: VoicePhase; level?: number; preview?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const values = useRef({ phase, level, preview });
  values.current = { phase, level, preview };
  useEffect(() => {
    const el = canvas.current!, ctx = el.getContext("2d");
    if (!ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    // Equal-area sphere: precompute once. Fine point sprites are grouped into depth buckets.
    const positions = new Float32Array(2800 * 3);
    for (let i = 0; i < 2800; i++) {
      const y = 1 - 2 * (i + .5) / 2800, r = Math.sqrt(1 - y * y), theta = i * 2.39996323;
      positions.set([r * Math.cos(theta), y, r * Math.sin(theta)], i * 3);
    }
    let frame = 0, last = 0, time = 0, smooth = 0, visible = true;
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; });
    observer.observe(el);
    function draw(now: number) {
      frame = requestAnimationFrame(draw);
      if (!ctx || !visible || document.hidden || now - last < 1000 / 24) return;
      const dt = Math.min((now - last) / 1000, .1); last = now;
      const { phase: p, level: l, preview: demo } = values.current;
      const animate = !reduced.matches && !["muted", "idle", "error"].includes(p);
      if (animate) time += dt;
      const thinking = p === "thinking" || p === "preparing";
      const energy = animate ? demo ? .3 + .22 * Math.sin(time * 4) ** 2 : Math.max(0, Math.min(1, l)) : 0;
      smooth += (energy - smooth) * .22;
      const width = el.clientWidth, height = el.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
      if (!width || !height) return;
      if (el.width !== Math.round(width * dpr) || el.height !== Math.round(height * dpr)) { el.width = Math.round(width * dpr); el.height = Math.round(height * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
      const cx = width / 2, cy = height / 2, radius = Math.min(width, height) * .34;
      const muted = p === "muted", rot = time * (thinking ? .6 : .16);
      if (style === "hologram") {
        const buckets: number[][] = Array.from({ length: 8 }, () => []);
        const cosine = Math.cos(rot), sine = Math.sin(rot);
        for (let i = 0; i < positions.length; i += 3) {
          const x = positions[i], y = positions[i + 1], z = positions[i + 2];
          const rx = x * cosine + z * sine, rz = z * cosine - x * sine;
          const scale = radius * (1 + smooth * .09 * Math.sin(y * 9 + time * 3 + rz * 4));
          const bucket = Math.min(7, Math.floor((rz + 1) * 4));
          buckets[bucket].push(cx + rx * scale, cy + y * scale);
        }
        buckets.forEach((points, depth) => {
          ctx.fillStyle = `rgba(2,39,255,${(muted ? .12 : .17 + depth * .105)})`;
          const r = .26 + depth * .045;
          ctx.beginPath();
          for (let j = 0; j < points.length; j += 2) { ctx.moveTo(points[j] + r, points[j + 1]); ctx.arc(points[j], points[j + 1], r, 0, Math.PI * 2); }
          ctx.fill();
        });
      } else {
        const gradient = ctx.createLinearGradient(cx-radius, cy-radius, cx+radius, cy+radius);
        gradient.addColorStop(0, "#94b7ff"); gradient.addColorStop(.4, "#315bff"); gradient.addColorStop(1, "#0227ff");
        ctx.strokeStyle = gradient;
        for (let layer = 0; layer < 18; layer++) {
          ctx.beginPath(); ctx.globalAlpha = muted ? .1 : .3 + layer / 40;
          for (let i = 0; i <= 100; i++) {
            const angle = i * Math.PI * 2 / 100;
            const r = radius + (layer - 9) * .9 + (2 + smooth * 11) * Math.sin(angle * 3 + time * (thinking ? .7 : 1.5) + layer * .2);
            const x = cx + Math.cos(angle) * r, y = cy + Math.sin(angle) * r;
            if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.closePath(); ctx.lineWidth = .8; ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [style]);
  return <canvas ref={canvas} className="voice-presence" role="img" aria-label={`Shackleton ${phase} · ${style === "hologram" ? "fine particle hologram" : "liquid core"}`} />;
}
