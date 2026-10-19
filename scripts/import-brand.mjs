import { copyFile, mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import path from "node:path";
const source = process.argv[2];
if (!source) {
  console.error(
    'Usage: npm run brand:import -- "/path/to/klinekraft logo_geometric@5x.png"',
  );
  process.exit(1);
}
const metadata = await sharp(source).metadata();
if (metadata.format !== "png")
  throw new Error("Supply the original PNG, without conversion.");
await mkdir("assets/brand", { recursive: true });
await mkdir("frontend/public/brand", { recursive: true });
const original = "assets/brand/klinekraft_logo_geometric.png";
if (path.resolve(source) !== path.resolve(original)) {
  await copyFile(source, original);
}
for (const size of [64, 128, 512]) {
  await sharp(source)
    .resize(size, size, { fit: "inside", withoutEnlargement: true })
    .png()
    .toFile(`frontend/public/brand/logo-${size}.png`);
}
// Transparent padding preserves the exact aspect ratio for square platform icons.
for (const [name, size] of [
  ["favicon", 32],
  ["app-icon", 512],
]) {
  await sharp(source)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(`frontend/public/brand/${name}.png`);
}
await writeFile(
  "frontend/public/brand/manifest.json",
  JSON.stringify({ available: true, logo: "/brand/logo-128.png" }, null, 2) +
    "\n",
);
console.log(
  `Imported ${path.basename(source)}. Original preserved; geometry and colors unchanged.`,
);
