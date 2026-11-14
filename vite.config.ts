import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
// Bundle PDF fonts, decoders and character maps locally for offline reading.
const pdfAssets = fileURLToPath(new URL("./frontend/public/pdfjs/", import.meta.url));
mkdirSync(pdfAssets, { recursive: true });
for (const folder of ["cmaps", "standard_fonts", "wasm", "iccs", "LICENSE"]) {
  cpSync(fileURLToPath(new URL(`./node_modules/pdfjs-dist/${folder}`, import.meta.url)), `${pdfAssets}/${folder}`, { recursive: true });
}
export default defineConfig({
  root: "frontend",
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true },
  preview: { proxy: { "/api": "http://127.0.0.1:8000" } },
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
});
