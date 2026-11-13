// Iterative connected-region fill avoids recursive stack overflow on large canvases.
export function floodFill(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  color: number[],
) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  const start = y * width + x,
    offset = start * 4;
  const target = Array.from(data.slice(offset, offset + 4));
  if (target.every((value, i) => value === color[i])) return false;
  const matches = (pixel: number) =>
    target.every((value, i) => data[pixel * 4 + i] === value);
  const paint = (pixel: number) => {
    for (let i = 0; i < 4; i++) data[pixel * 4 + i] = color[i];
  };
  const queue = new Int32Array(width * height);
  let head = 0,
    tail = 1;
  queue[0] = start;
  paint(start);
  while (head < tail) {
    const pixel = queue[head++],
      column = pixel % width;
    const visit = (next: number) => {
      if (matches(next)) {
        paint(next);
        queue[tail++] = next;
      }
    };
    if (column > 0) visit(pixel - 1);
    if (column < width - 1) visit(pixel + 1);
    if (pixel >= width) visit(pixel - width);
    if (pixel < width * (height - 1)) visit(pixel + width);
  }
  return true;
}
