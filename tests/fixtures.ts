import type { Airport, FlightInput } from "../src/shared";
export const prg: Airport = {
  id: "LKPR",
  iata: "PRG",
  icao: "LKPR",
  name: "Václav Havel Airport Prague",
  city: "Prague",
  country: "CZ",
  latitude: 50.1008,
  longitude: 14.26,
  closed: false,
};
export const lhr: Airport = {
  id: "EGLL",
  iata: "LHR",
  icao: "EGLL",
  name: "London Heathrow Airport",
  city: "London",
  country: "GB",
  latitude: 51.4706,
  longitude: -0.461941,
  closed: false,
};
export const hnd: Airport = {
  id: "RJTT",
  iata: "HND",
  icao: "RJTT",
  name: "Tokyo Haneda International Airport",
  city: "Tokyo",
  country: "JP",
  latitude: 35.5523,
  longitude: 139.78,
  closed: false,
};
export const sfo: Airport = {
  id: "KSFO",
  iata: "SFO",
  icao: "KSFO",
  name: "San Francisco International Airport",
  city: "San Francisco",
  country: "US",
  latitude: 37.6198,
  longitude: -122.375,
  closed: false,
};
export const input: FlightInput & { stops: Airport[] } = {
  stops: [],
  origin: prg,
  destination: lhr,
  date: "2024-07-09",
  flightNumber: "BA853",
};
export const airports = [prg, lhr, hnd, sfo];
