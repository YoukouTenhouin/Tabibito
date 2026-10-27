import type { Airport } from "../src/shared";

export type Binding = Record<
  string,
  { value: string; "xml:lang"?: string; type?: string }
>;
export type Snapshot = {
  complete: boolean;
  fetchedAt: string;
  identities: { results: { bindings: Binding[] } };
  names: { results: { bindings: Binding[] } };
};
type Entry = {
  name?: string;
  city?: string;
  aliases: string[];
  latitude: number;
  longitude: number;
  sourceCity: string;
  entity: string;
};
type Coverage = {
  total: number;
  translated: number;
  names: number;
  cities: number;
  ambiguous: number;
};
export function buildTranslations(
  catalog: Airport[],
  snapshot: Snapshot,
): { airports: Record<string, Entry>; coverage: Coverage };
export function fetchSnapshot(
  catalog: Airport[],
  fetcher?: typeof fetch,
): Promise<Snapshot>;
export function writeTranslations(
  catalog: Airport[],
  snapshot: Snapshot,
  destination: string,
  options?: { minimum?: number; catalogText?: string },
): Promise<Coverage>;
