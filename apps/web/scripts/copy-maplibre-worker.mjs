// MapLibre starts its tile worker from a file next to its own module, which the Next bundle does not keep, so the
// worker files are served from public/maplibre (search-map.tsx points MapLibre there with setWorkerUrl).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/package.json")) + "/dist";
const target = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "maplibre");
mkdirSync(target, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(dist, file), join(target, file));
}
