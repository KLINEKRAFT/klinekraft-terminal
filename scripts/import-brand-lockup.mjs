import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source = process.argv[2];
if (!source)
  throw new Error('Usage: npm run brand:lockup -- "/path/to/logo.png"');
const metadata = await sharp(source).metadata();
if (metadata.format !== "png") throw new Error("Supply the original PNG.");
const original = "assets/brand/klinekraft_terminal_logo@5x.png";
await mkdir("assets/brand", { recursive: true });
await mkdir("frontend/public/brand", { recursive: true });
if (path.resolve(source) !== path.resolve(original))
  await copyFile(source, original);
for (const width of [320, 640]) {
  await sharp(source)
    .resize({ width, withoutEnlargement: true })
    .png()
    .toFile(`frontend/public/brand/lockup-${width}.png`);
}
const manifestPath = "frontend/public/brand/manifest.json";
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
await writeFile(
  manifestPath,
  JSON.stringify(
    {
      ...manifest,
      lockup: "/brand/lockup-320.png",
      lockup2x: "/brand/lockup-640.png",
      lockupWidth: metadata.width,
      lockupHeight: metadata.height,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Imported complete lockup (${metadata.width} × ${metadata.height}); original preserved.`,
);
