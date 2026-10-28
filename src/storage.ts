import { AppError } from "./errors";
import {
  backupSchema,
  flightInputSchema,
  flightSchema,
  type Backup,
  type Flight,
  type FlightInput,
} from "./shared";

const request = <T>(value: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error);
  });
const sorted = (flights: Flight[]) =>
  flights.sort(
    (a, b) =>
      Number(a.date === null) - Number(b.date === null) ||
      (b.date ?? "").localeCompare(a.date ?? "") ||
      a.id.localeCompare(b.id),
  );

export class FlightStore {
  constructor(private readonly name = "tabibito") {}
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const opening = indexedDB.open(this.name, 1);
      opening.onupgradeneeded = () => {
        opening.result.createObjectStore("flights", { keyPath: "id" });
        opening.result.createObjectStore("metadata");
      };
      opening.onerror = () => reject(new AppError("errors.storageOpen"));
      let blocked = false;
      opening.onblocked = () => {
        blocked = true;
        reject(new AppError("errors.storageBlocked"));
      };
      opening.onsuccess = () => {
        if (blocked) {
          opening.result.close();
          return;
        }
        opening.result.onversionchange = () => opening.result.close();
        resolve(opening.result);
      };
    });
  }
  private async transaction<T>(
    write: boolean,
    action: (flights: IDBObjectStore, metadata: IDBObjectStore) => Promise<T>,
  ): Promise<T> {
    const db = await this.open();
    try {
      const tx = db.transaction(
        ["flights", "metadata"],
        write ? "readwrite" : "readonly",
      );
      const completed = new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onabort = () =>
          reject(tx.error ?? new AppError("errors.storageTransaction"));
        tx.onerror = () => {
          /* onabort reports the transaction failure. */
        };
      });
      // Observe aborts immediately, even while the action is awaiting a request.
      void completed.catch(() => {});
      try {
        const metadata = tx.objectStore("metadata");
        const result = await action(tx.objectStore("flights"), metadata);
        if (write) {
          const revision = (await request(metadata.get("revision"))) ?? 0;
          await request(metadata.put(revision + 1, "revision"));
        }
        await completed;
        return result;
      } catch (error) {
        try {
          tx.abort();
        } catch {
          /* Already aborted or completed. */
        }
        await completed.catch(() => {});
        throw error;
      }
    } finally {
      db.close();
    }
  }
  list() {
    return this.transaction(false, async (flights) =>
      sorted(flightSchema.array().parse(await request(flights.getAll()))),
    );
  }
  create(input: FlightInput) {
    const parsed = flightInputSchema.parse(input);
    return this.transaction(true, async (flights) => {
      const now = new Date().toISOString();
      const flight: Flight = {
        ...parsed,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      };
      await request(flights.add(flight));
      return flight;
    });
  }
  update(id: string, input: FlightInput) {
    const parsed = flightInputSchema.parse(input);
    return this.transaction(true, async (flights) => {
      const old = await request(flights.get(id));
      if (!old) throw new AppError("errors.flightMissing");
      const flight: Flight = {
        ...flightSchema.parse(old),
        ...parsed,
        updatedAt: new Date().toISOString(),
      };
      await request(flights.put(flight));
      return flight;
    });
  }
  delete(id: string) {
    return this.transaction(true, async (flights) => {
      await request(flights.delete(id));
    });
  }
  async export(): Promise<Backup> {
    return {
      app: "tabibito",
      version: 2,
      exportedAt: new Date().toISOString(),
      flights: await this.list(),
    };
  }
  preview(input: Backup) {
    const backup = backupSchema.parse(input);
    return this.transaction(false, async (flights, metadata) => ({
      incomingCount: backup.flights.length,
      currentCount: await request(flights.count()),
      expectedRevision: String((await request(metadata.get("revision"))) ?? 0),
    }));
  }
  restore(input: Backup, expectedRevision: string) {
    const backup = backupSchema.parse(input);
    return this.transaction(true, async (flights, metadata) => {
      if (
        String((await request(metadata.get("revision"))) ?? 0) !==
        expectedRevision
      )
        throw new AppError("errors.historyChanged");
      await request(flights.clear());
      for (const flight of backup.flights) await request(flights.add(flight));
    });
  }
}
export const flightStore = new FlightStore();
