import { readFile } from "node:fs/promises";
import { source, writeCatalog } from "./airport-catalog.mjs";

// An optional local CSV supports preparing the bundle on offline installations.
const response = process.argv[2]
  ? null
  : await fetch(source, { signal: AbortSignal.timeout(60_000) });
if (response && !response.ok)
  throw new Error(`Airport download failed: HTTP ${response.status}`);
const csv = process.argv[2]
  ? await readFile(process.argv[2], "utf8")
  : await response.text();
console.log(`Bundled ${await writeCatalog(csv)} airports.`);
