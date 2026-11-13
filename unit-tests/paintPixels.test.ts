import { test } from "node:test";
import assert from "node:assert/strict";
import { floodFill } from "../frontend/src/components/paintPixels.ts";

test("fill stays inside connected boundaries without wrapping rows", () => {
  const pixels = new Uint8ClampedArray(4 * 3 * 4).fill(255);
  for (const pixel of [1, 5, 9]) pixels.set([0, 0, 0, 255], pixel * 4);
  assert.equal(floodFill(pixels, 4, 3, 0, 1, [255, 106, 0, 255]), true);
  for (const pixel of [0, 4, 8])
    assert.deepEqual(
      Array.from(pixels.slice(pixel * 4, pixel * 4 + 4)),
      [255, 106, 0, 255],
    );
  for (const pixel of [2, 3, 6, 7, 10, 11])
    assert.deepEqual(
      Array.from(pixels.slice(pixel * 4, pixel * 4 + 4)),
      [255, 255, 255, 255],
    );
});
test("same-color and out-of-bounds fills leave pixels untouched", () => {
  const pixels = new Uint8ClampedArray(16).fill(255);
  assert.equal(floodFill(pixels, 2, 2, 0, 0, [255, 255, 255, 255]), false);
  assert.equal(floodFill(pixels, 2, 2, -1, 0, [0, 0, 0, 255]), false);
  assert.ok(pixels.every((value) => value === 255));
});
test("maximum supported canvas fills without recursive overflow", () => {
  const pixels = new Uint8ClampedArray(1600 * 1200 * 4).fill(255);
  floodFill(pixels, 1600, 1200, 1599, 1199, [0, 61, 165, 255]);
  for (let i = 0; i < pixels.length; i += 4) {
    assert.equal(pixels[i], 0);
    assert.equal(pixels[i + 1], 61);
    assert.equal(pixels[i + 2], 165);
  }
});
