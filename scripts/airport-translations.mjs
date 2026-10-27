import { createHash } from "node:crypto";
import { readFile, writeFile, rename } from "node:fs/promises";
import * as OpenCC from "opencc-js";

export const endpoint = "https://query.wikidata.org/sparql";
export const queries = {
  identities: `SELECT ?entity ?CODE ?coordinates ?city WHERE {
    VALUES ?CODE { VALUES_LIST } ?entity wdt:PROPERTY ?CODE.
    OPTIONAL { ?entity wdt:P625 ?coordinates }
    OPTIONAL { ?entity wdt:P931 ?city }
  }`,
  names: `SELECT ?entity ?kind ?value WHERE {
    VALUES ?entity { VALUES_LIST }
    VALUES ?kind { rdfs:label skos:altLabel }
    ?entity ?kind ?value.
    FILTER(LANG(?value) IN ("en", "zh-hans", "zh-cn", "zh-sg", "zh", "zh-hant", "zh-tw", "zh-hk"))
  }`,
};

const simplify = OpenCC.Converter({ from: "t", to: "cn" });
const normalize = (value) =>
  value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
const languages = [
  "zh-hans",
  "zh-cn",
  "zh-sg",
  "zh",
  "zh-hant",
  "zh-tw",
  "zh-hk",
];
const distance = (a, b) => {
  const rad = (v) => (v * Math.PI) / 180;
  const h =
    Math.sin(rad(b[1] - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b[1])) *
      Math.sin(rad(b[0] - a.longitude) / 2) ** 2;
  return 12742.0176 * Math.asin(Math.sqrt(Math.min(1, h)));
};

function bindings(result) {
  if (!Array.isArray(result?.results?.bindings))
    throw new Error("Incomplete Wikidata response.");
  return result.results.bindings;
}

/** Pure transformation: no network, stable output, never changes canonical airport data. */
export function buildTranslations(catalog, snapshot) {
  if (snapshot.complete !== true)
    throw new Error("Incomplete translation snapshot.");
  const entities = new Map();
  for (const row of bindings(snapshot.identities)) {
    if (!row.entity?.value) throw new Error("Invalid identity row.");
    const id = row.entity.value;
    const entry = entities.get(id) ?? {
      icao: new Set(),
      iata: new Set(),
      coordinates: [],
      cities: new Set(),
    };
    for (const code of ["icao", "iata"])
      if (row[code]?.value) entry[code].add(row[code].value);
    if (row.city?.value) entry.cities.add(row.city.value);
    if (row.coordinates?.value) {
      const match = /^Point\((-?[\d.]+) (-?[\d.]+)\)$/.exec(
        row.coordinates.value,
      );
      if (match) entry.coordinates.push([Number(match[1]), Number(match[2])]);
    }
    entities.set(id, entry);
  }
  const names = new Map();
  for (const row of bindings(snapshot.names)) {
    if (
      !row.entity?.value ||
      !row.value?.value ||
      !row.value["xml:lang"] ||
      !row.kind?.value
    )
      throw new Error("Invalid name row.");
    const entries = names.get(row.entity.value) ?? [];
    entries.push({
      text: row.value.value,
      language: row.value["xml:lang"],
      label: row.kind.value.endsWith("#label"),
    });
    names.set(row.entity.value, entries);
  }
  const label = (id) => {
    const entries = names.get(id) ?? [];
    for (const language of languages) {
      const values = entries
        .filter(
          (x) =>
            x.language === language &&
            x.label &&
            /\p{Script=Han}/u.test(x.text),
        )
        .map((x) => simplify(x.text))
        .sort();
      if (values.length) return values[0];
    }
  };
  const aliases = (id) =>
    (names.get(id) ?? [])
      .filter((x) => languages.includes(x.language))
      .flatMap((x) => [x.text, simplify(x.text)]);
  const indexes = { icao: new Map(), iata: new Map() };
  for (const [id, entity] of entities)
    for (const kind of ["icao", "iata"])
      for (const code of entity[kind]) {
        const ids = indexes[kind].get(code) ?? new Set();
        ids.add(id);
        indexes[kind].set(code, ids);
      }
  const airports = {};
  let ambiguous = 0;
  for (const airport of [...catalog].sort((a, b) =>
    a.id.localeCompare(b.id, "en"),
  )) {
    let matches = [];
    for (const kind of ["icao", "iata"]) {
      matches = [...(indexes[kind].get(airport[kind]) ?? [])].filter((id) =>
        entities
          .get(id)
          .coordinates.some((point) => distance(airport, point) <= 5),
      );
      if (matches.length) break;
    }
    if (matches.length !== 1) {
      if (matches.length > 1) ambiguous++;
      continue;
    }
    const id = matches[0],
      entity = entities.get(id);
    const cityMatches = [...entity.cities].filter((city) =>
      (names.get(city) ?? []).some(
        (x) =>
          x.language === "en" && normalize(x.text) === normalize(airport.city),
      ),
    );
    const city = cityMatches.length === 1 ? label(cityMatches[0]) : undefined;
    const name = label(id);
    const search = [
      ...new Set([...aliases(id), ...[...entity.cities].flatMap(aliases)]),
    ].sort();
    if (!name && !city && !search.length) continue;
    airports[airport.id] = {
      ...(name ? { name } : {}),
      ...(city ? { city } : {}),
      aliases: search,
      // Guard imported/historic snapshots against reuse of a catalog identifier.
      latitude: airport.latitude,
      longitude: airport.longitude,
      sourceCity: airport.city,
      entity: id.split("/").pop(),
    };
  }
  return {
    airports,
    coverage: {
      total: catalog.length,
      translated: Object.keys(airports).length,
      names: Object.values(airports).filter((x) => x.name).length,
      cities: Object.values(airports).filter((x) => x.city).length,
      ambiguous,
    },
  };
}

export async function fetchSnapshot(catalog, fetcher = fetch) {
  const request = async (query) => {
    const url = `${endpoint}?format=json&query=${encodeURIComponent(query)}`;
    let failure;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetcher(url, {
          headers: {
            Accept: "application/sparql-results+json",
            "User-Agent": "Tabibito-airport-translations/1.0",
          },
          signal: AbortSignal.timeout(30000),
        });
        if (!response.ok) throw new Error(`Wikidata: HTTP ${response.status}`);
        return bindings(await response.json());
      } catch (error) {
        failure = error;
        if (attempt < 2)
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * (attempt + 1)),
          );
      }
    }
    throw failure;
  };
  const chunks = (values) =>
    Array.from({ length: Math.ceil(values.length / 50) }, (_, i) =>
      values.slice(i * 50, (i + 1) * 50),
    );
  const run = async (requests, phase) => {
    const results = new Array(requests.length);
    let next = 0,
      completed = 0;
    // Keep well below the query service's five concurrent request limit.
    const worker = async () => {
      while (next < requests.length) {
        const index = next++;
        results[index] = await request(requests[index]);
        if (++completed % 50 === 0 || completed === requests.length)
          console.log(`${phase}: ${completed}/${requests.length} batches`);
      }
    };
    await Promise.all([worker(), worker()]);
    return { results: { bindings: results.flat() } };
  };
  const identityQueries = ["icao", "iata"].flatMap((kind) => {
    const codes = [
      ...new Set(catalog.map((airport) => airport[kind]).filter(Boolean)),
    ].sort();
    return chunks(codes).map((batch) =>
      queries.identities
        .replaceAll("CODE", kind)
        .replace("PROPERTY", kind === "icao" ? "P239" : "P238")
        .replace(
          "VALUES_LIST",
          batch.map((code) => JSON.stringify(code)).join(" "),
        ),
    );
  });
  const identities = await run(identityQueries, "Airport identities");
  const ids = [
    ...new Set(
      bindings(identities)
        .flatMap((row) => [row.entity?.value, row.city?.value])
        .filter(Boolean),
    ),
  ].sort();
  if (
    !ids.length ||
    ids.some((id) => !/^https?:\/\/www\.wikidata\.org\/entity\/Q\d+$/.test(id))
  )
    throw new Error("Missing or invalid Wikidata entities.");
  const nameQueries = chunks(ids).map((batch) =>
    queries.names.replace(
      "VALUES_LIST",
      batch.map((id) => `wd:${id.split("/").pop()}`).join(" "),
    ),
  );
  const names = await run(nameQueries, "Place names");
  return {
    fetchedAt: new Date().toISOString(),
    identities,
    names,
    complete: true,
  };
}

export async function writeTranslations(
  catalog,
  snapshot,
  destination,
  { minimum = 100, catalogText = JSON.stringify(catalog) } = {},
) {
  const result = buildTranslations(catalog, snapshot);
  if (result.coverage.names < minimum)
    throw new Error(
      "Translation dataset unexpectedly small; existing data was not replaced.",
    );
  let previous;
  try {
    previous = JSON.parse(await readFile(destination, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (
    previous &&
    result.coverage.names < previous.metadata.coverage.names * 0.9
  )
    throw new Error(
      "Translation coverage dropped by over 10%; existing data was not replaced.",
    );
  const output = {
    metadata: {
      source: endpoint,
      license: "CC0-1.0",
      fetchedAt: snapshot.fetchedAt,
      snapshotSha256: createHash("sha256")
        .update(JSON.stringify(snapshot))
        .digest("hex"),
      catalogSha256: createHash("sha256").update(catalogText).digest("hex"),
      queries,
      coverage: result.coverage,
    },
    airports: result.airports,
  };
  await writeFile(`${destination}.tmp`, JSON.stringify(output) + "\n");
  await rename(`${destination}.tmp`, destination);
  return result.coverage;
}
