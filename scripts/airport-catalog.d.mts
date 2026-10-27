import type { Airport } from "../src/shared.js";
export const source: string;
export function parseAirportCsv(csv: string): Airport[];
export function writeCatalog(csv: string, directory?: string): Promise<number>;
