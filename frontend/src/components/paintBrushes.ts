export type BrushKind = "round" | "square" | "chisel" | "soft" | "spray";
export function drawBrush(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  width: number,
  color: string,
  kind: BrushKind,
) {
  ctx.save();
  ctx.fillStyle = ctx.strokeStyle = color;
  if (kind === "round") {
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    if (from.x === to.x && from.y === to.y) {
      ctx.beginPath();
      ctx.arc(to.x, to.y, width / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const count = Math.max(1, Math.ceil(distance / Math.max(1, width / 5)));
    for (let step = distance === 0 ? 0 : 1; step <= count; step++) {
      const x = from.x + ((to.x - from.x) * step) / count,
        y = from.y + ((to.y - from.y) * step) / count;
      if (kind === "square")
        ctx.fillRect(x - width / 2, y - width / 2, width, width);
      if (kind === "chisel") {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-Math.PI / 4);
        ctx.fillRect(
          -width / 2,
          -Math.max(1, width / 5) / 2,
          width,
          Math.max(1, width / 5),
        );
        ctx.restore();
      }
      if (kind === "soft") {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, width / 2);
        gradient.addColorStop(0, color + "80");
        gradient.addColorStop(1, color + "00");
        ctx.fillStyle = gradient;
        ctx.fillRect(x - width / 2, y - width / 2, width, width);
      }
      if (kind === "spray") {
        ctx.globalAlpha = 0.65;
        for (let dot = 0; dot < Math.max(5, width); dot++) {
          const angle = Math.random() * Math.PI * 2,
            radius = (Math.sqrt(Math.random()) * width) / 2;
          ctx.fillRect(
            x + Math.cos(angle) * radius,
            y + Math.sin(angle) * radius,
            1,
            1,
          );
        }
      }
      if (distance === 0) break;
    }
  }
  ctx.restore();
}
