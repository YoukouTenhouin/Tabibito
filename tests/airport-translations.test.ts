import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildTranslations,
  fetchSnapshot,
  writeTranslations,
  type Binding,
  type Snapshot,
} from "../scripts/airport-translations.mjs";
import { lhr } from "./fixtures";

const airport = "http://www.wikidata.org/entity/Q8691",
  city = "http://www.wikidata.org/entity/Q84";
const name = (
  entity: string,
  value: string,
  language: string,
  alias = false,
): Binding => ({
  entity: { value: entity },
  kind: {
    value: alias
      ? "http://www.w3.org/2004/02/skos/core#altLabel"
      : "http://www.w3.org/2000/01/rdf-schema#label",
  },
  value: { value, "xml:lang": language },
});
function snapshot(): Snapshot {
  return {
    complete: true,
    fetchedAt: "2026-10-27T00:00:00Z",
    identities: {
      results: {
        bindings: [
          {
            entity: { value: airport },
            icao: { value: "EGLL" },
            coordinates: { value: `Point(${lhr.longitude} ${lhr.latitude})` },
            city: { value: city },
          },
        ],
      },
    },
    names: {
      results: {
        bindings: [
          name(airport, "希斯羅機場", "zh"),
          name(airport, "希思罗机场", "zh-hans"),
          name(airport, "伦敦希思罗", "zh", true),
          name(city, "London", "en"),
          name(city, "倫敦", "zh"),
        ],
      },
    },
  };
}
const directories: string[] = [];
afterEach(async () => {
  for (const dir of directories.splice(0))
    await rm(dir, { recursive: true, force: true });
  vi.useRealTimers();
});

describe("Chinese place-name generation", () => {
  it("prefers Simplified labels, converts generic Chinese and indexes aliases", () => {
    const result = buildTranslations([lhr], snapshot());
    expect(result.airports[lhr.id]).toMatchObject({
      name: "希思罗机场",
      city: "伦敦",
      sourceCity: "London",
    });
    expect(result.airports[lhr.id].aliases).toContain("伦敦希思罗");
    expect(result.airports[lhr.id].aliases).toContain("希斯罗机场");
    expect(result.coverage.names).toBe(1);
  });
  it("does not relabel a different municipality as the city served", () => {
    expect(
      buildTranslations([{ ...lhr, city: "Hillingdon" }], snapshot()).airports[
        lhr.id
      ].city,
    ).toBeUndefined();
  });
  it("rejects distant and ambiguous code matches, including reused historic codes", () => {
    expect(
      buildTranslations([{ ...lhr, latitude: 0 }], snapshot()).coverage.names,
    ).toBe(0);
    const raw = snapshot();
    raw.identities.results.bindings.push({
      ...raw.identities.results.bindings[0],
      entity: { value: "http://www.wikidata.org/entity/Q123" },
    });
    expect(buildTranslations([lhr], raw).coverage).toMatchObject({
      names: 0,
      ambiguous: 1,
    });
  });
  it("is deterministic and leaves its inputs unchanged", () => {
    const raw = snapshot(),
      original = structuredClone(raw);
    const result = buildTranslations([lhr], raw);
    raw.names.results.bindings.reverse();
    expect(buildTranslations([lhr], raw)).toEqual(result);
    raw.names.results.bindings.reverse();
    expect(raw).toEqual(original);
  });
  it("preserves the previous bundle when a snapshot is incomplete or loses coverage", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tabibito-translations-"));
    directories.push(dir);
    const path = join(dir, "names.json");
    await writeTranslations([lhr], snapshot(), path, { minimum: 1 });
    const original = await readFile(path, "utf8");
    await expect(
      writeTranslations([lhr], { ...snapshot(), complete: false }, path, {
        minimum: 1,
      }),
    ).rejects.toThrow("Incomplete");
    await expect(
      writeTranslations([], snapshot(), path, { minimum: 0 }),
    ).rejects.toThrow("coverage dropped");
    expect(await readFile(path, "utf8")).toBe(original);
  });
  it("does not declare failed source requests a complete snapshot", async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("unavailable", { status: 503 }));
    const promise = expect(fetchSnapshot([lhr], fetcher)).rejects.toThrow(
      "HTTP 503",
    );
    await vi.runAllTimersAsync();
    await promise;
  });
});
