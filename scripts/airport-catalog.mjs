import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

export const source =
  "https://davidmegginson.github.io/ourairports-data/airports.csv";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n")) {
      row.push(field.replace(/\r$/, ""));
      field = "";
      if (c === "\n") {
        rows.push(row);
        row = [];
      }
    } else field += c;
  }
  if (quoted) throw new Error("Unterminated CSV field.");
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

export function parseAirportCsv(csv) {
  const [headers, ...rows] = parseCsv(csv.replace(/^\uFEFF/, ""));
  const required = [
    "ident",
    "type",
    "name",
    "latitude_deg",
    "longitude_deg",
    "iso_country",
    "gps_code",
    "iata_code",
    "municipality",
  ];
  if (!headers || required.some((column) => !headers.includes(column))) {
    throw new Error("The CSV is missing required OurAirports columns.");
  }
  const airports = [];
  for (const fields of rows) {
    const row = Object.fromEntries(
      headers.map((header, i) => [header, fields[i] ?? ""]),
    );
    const iata = /^[A-Z0-9]{3}$/.test(row.iata_code) ? row.iata_code : null;
    const icao = /^[A-Z]{4}$/.test(row.gps_code) ? row.gps_code : null;
    const latitude = Number(row.latitude_deg),
      longitude = Number(row.longitude_deg);
    if (
      (!iata && !icao) ||
      !row.ident ||
      !row.name ||
      !/^[A-Z]{2}$/.test(row.iso_country) ||
      !row.latitude_deg ||
      !row.longitude_deg ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    )
      continue;
    airports.push({
      id: row.ident,
      name: row.name,
      city: row.municipality,
      country: row.iso_country,
      iata,
      icao,
      latitude,
      longitude,
      closed: row.type === "closed",
    });
  }
  if (airports.length < 1000)
    throw new Error(
      "Airport download unexpectedly small; existing catalog was not replaced.",
    );
  return airports;
}

export async function writeCatalog(csv, directory = "data") {
  const airports = parseAirportCsv(csv);
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "airports.json.tmp"),
    JSON.stringify(airports),
  );
  await rename(
    join(directory, "airports.json.tmp"),
    join(directory, "airports.json"),
  );
  await writeFile(
    join(directory, "airports-source.json"),
    JSON.stringify(
      {
        source,
        license: "Public domain",
        downloadedAt: new Date().toISOString(),
        count: airports.length,
        sha256: createHash("sha256").update(csv).digest("hex"),
      },
      null,
      2,
    ) + "\n",
  );
  return airports.length;
}
