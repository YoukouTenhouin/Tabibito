import { afterEach, describe, expect, it } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { airportSchema } from "../src/shared";
import { writeCatalog } from "../scripts/airport-catalog.mjs";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});
const header =
  "ident,type,name,latitude_deg,longitude_deg,iso_country,gps_code,iata_code,municipality\n";
function setup(csv: string) {
  const dir = mkdtempSync(join(tmpdir(), "tabibito-catalog-"));
  dirs.push(dir);
  return { dir, run: () => writeCatalog(csv, join(dir, "data")) };
}
describe("bundled airport catalog generation", () => {
  it("imports quoted commas, escaped quotes and Unicode from the source CSV", async () => {
    const rows = Array.from(
      { length: 1001 },
      (_, i) =>
        `TST${i},${i === 0 ? "closed" : "large_airport"},"Václav, \"\"Test\"\" Airport",50.1008,14.26,CZ,LKPR,PRG,Prague`,
    ).join("\n");
    const { dir, run } = setup(header + rows + "\n");
    await run();
    const catalog = airportSchema
      .array()
      .parse(JSON.parse(readFileSync(join(dir, "data/airports.json"), "utf8")));
    expect(catalog).toHaveLength(1001);
    expect(catalog[0].name).toBe('Václav, "Test" Airport');
    expect(catalog[0].closed).toBe(true);
    expect(
      JSON.parse(readFileSync(join(dir, "data/airports-source.json"), "utf8"))
        .sha256,
    ).toMatch(/^[a-f0-9]{64}$/);
  });
  it("leaves an existing snapshot untouched when the source is truncated", async () => {
    const { dir, run } = setup(
      header + "LKPR,large_airport,Prague,50,14,CZ,LKPR,PRG,Prague\n",
    );
    mkdirSync(join(dir, "data"));
    writeFileSync(join(dir, "data/airports.json"), "original");
    await expect(run()).rejects.toThrow("unexpectedly small");
    expect(readFileSync(join(dir, "data/airports.json"), "utf8")).toBe(
      "original",
    );
  });
  it("rejects malformed CSV before replacing a snapshot", async () => {
    const { run } = setup(header + 'LKPR,large_airport,"unterminated\n');
    await expect(run()).rejects.toThrow("Unterminated CSV field");
  });
});
