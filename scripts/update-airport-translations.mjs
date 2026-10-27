import { readFile, writeFile } from "node:fs/promises";
import { fetchSnapshot, writeTranslations } from "./airport-translations.mjs";

// Optional input snapshot and output snapshot allow reproducible, offline updates.
const [input, savedSnapshot] = process.argv.slice(2);
const catalogText = await readFile("data/airports.json", "utf8");
const snapshot = input
  ? JSON.parse(await readFile(input, "utf8"))
  : await fetchSnapshot(JSON.parse(catalogText));
if (savedSnapshot) await writeFile(savedSnapshot, JSON.stringify(snapshot));
console.log(
  await writeTranslations(
    JSON.parse(catalogText),
    snapshot,
    "data/airports-zh-Hans.json",
    { catalogText },
  ),
);
