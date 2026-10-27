import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { FlightStore } from "../src/storage";
import { backupSchema } from "../src/shared";
import { input } from "./fixtures";

const setup = () => new FlightStore(crypto.randomUUID());
describe("browser flight storage", () => {
  it("persists flights, sorts undated last, preserves repeated routes and timestamps", async () => {
    const name = crypto.randomUUID();
    const store = new FlightStore(name);
    const undated = await store.create({ ...input, date: null });
    const dated = await store.create(input);
    expect(await new FlightStore(name).list()).toEqual([dated, undated]);
    const edited = await store.update(dated.id, {
      ...input,
      flightNumber: "BA9",
    });
    expect(edited.createdAt).toBe(dated.createdAt);
    expect(edited.id).toBe(dated.id);
    await store.delete(undated.id);
    expect(await store.list()).toEqual([edited]);
    await expect(store.update(undated.id, input)).rejects.toThrow(
      "no longer exists",
    );
  });
  it("round trips v1 snapshots and supports empty replacement", async () => {
    const store = setup();
    await store.create(input);
    const backup = backupSchema.parse(
      JSON.parse(JSON.stringify(await store.export())),
    );
    const other = setup();
    await other.restore(backup, (await other.preview(backup)).expectedRevision);
    expect(await other.list()).toEqual(backup.flights);
    const empty = { ...backup, flights: [] };
    await other.restore(empty, (await other.preview(empty)).expectedRevision);
    expect(await other.list()).toEqual([]);
  });
  it("rejects a stale preview after another tab writes without losing either record", async () => {
    const name = crypto.randomUUID();
    const store = new FlightStore(name);
    await store.create(input);
    const backup = await store.export();
    const preview = await store.preview(backup);
    await new FlightStore(name).create(input);
    await expect(
      store.restore(backup, preview.expectedRevision),
    ).rejects.toThrow("History changed");
    expect(await store.list()).toHaveLength(2);
  });
  it("invalid or duplicate backups leave the history intact", async () => {
    const store = setup();
    await store.create(input);
    const backup = await store.export();
    expect(() =>
      store.restore(
        { ...backup, flights: [...backup.flights, ...backup.flights] },
        "1",
      ),
    ).toThrow();
    expect(await store.list()).toEqual(backup.flights);
  });
  it("rolls back replacement if storage fails after clearing", async () => {
    const store = setup();
    await store.create(input);
    const backup = await store.export();
    const preview = await store.preview(backup);
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function () {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
    try {
      await expect(
        store.restore(backup, preview.expectedRevision),
      ).rejects.toThrow("Storage full");
    } finally {
      IDBObjectStore.prototype.add = original;
    }
    expect(await store.list()).toEqual(backup.flights);
  });
});
