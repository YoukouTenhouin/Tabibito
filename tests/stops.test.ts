import { expect, it } from 'vitest';
import { flightInputSchema, backupSchema, filteredFlights } from '../src/shared';
import { routeFeatures, airportFeatures } from '../src/geometry';
import { flightDistanceKm } from '../src/distance';
import { input, hnd, sfo } from './fixtures';
it('preserves ordered stops across route geometry, search and distance', () => {
 const flight = { ...input, stops: [hnd, sfo], id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
 expect(routeFeatures([flight]).features).toHaveLength(3);
 expect(routeFeatures([flight]).features.every(f => f.properties?.id === flight.id)).toBe(true);
 expect(airportFeatures([flight]).features).toHaveLength(4);
 expect(filteredFlights([flight], 'Tokyo', '')).toEqual([flight]);
 expect(flightDistanceKm(flight)).toBeCloseTo(flightDistanceKm({origin: input.origin, destination: hnd}) + flightDistanceKm({origin: hnd, destination: sfo}) + flightDistanceKm({origin: sfo, destination: input.destination}));
 expect(flightInputSchema.safeParse({...input, stops: [input.origin]}).success).toBe(false);
 expect(flightInputSchema.safeParse({...input, stops: [hnd, hnd]}).success).toBe(false);
 const { stops, ...legacy } = flight;
 expect(backupSchema.parse({app:'tabibito',version:1,exportedAt:flight.createdAt,flights:[legacy]}).flights[0].stops).toEqual([]);
 expect(backupSchema.parse({app:'tabibito',version:2,exportedAt:flight.createdAt,flights:[flight]}).flights[0]).toEqual(flight);
});
it('normalizes legacy backups to an idempotent current backup', () => {
 const { stops, ...legacyInput } = input;
 const backup = backupSchema.parse({app:'tabibito', version:1, exportedAt:new Date().toISOString(), flights:[{...legacyInput,id:crypto.randomUUID(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}]});
 expect(backupSchema.parse(backup)).toEqual(backup);
});
