import { Flight } from '../models';
import { AirportRecord, haversineKm } from '../services/airport-db.service';

export interface RoutePoint {
  code: string;
  city: string;
  lat: number;
  lon: number;
}

export interface RouteLine {
  from: RoutePoint;
  to: RoutePoint;
  count: number;
  /** Not flown yet. */
  upcoming: boolean;
}

export interface TravelSummary {
  flights: number;
  km: number;
  hours: number;
  /** ISO country codes, in the order first visited. */
  countries: string[];
  airports: number;
  /** Times around the Earth (equator, 40,075 km). */
  laps: number;
  longest?: { from: string; to: string; km: number };
  topCity?: { city: string; count: number };
  routes: RouteLine[];
}

/**
 * Totals for flights already landed; upcoming ones only add routes to the map. Shared by Profile and
 * Passport so both always show the same numbers.
 */
export function summarize(all: Flight[], lookup: (code: string) => AirportRecord | undefined, now = Date.now()): TravelSummary {
  const sorted = [...all].sort((a, b) => +new Date(a.departure) - +new Date(b.departure));
  const flown = sorted.filter((f) => new Date(f.arrival).getTime() < now);
  const countries: string[] = [];
  const airports = new Set<string>();
  const cities = new Map<string, number>();
  const routes = new Map<string, RouteLine>();
  let km = 0;
  let minutes = 0;
  let longest: TravelSummary['longest'];

  const point = (code: string, city: string): RoutePoint | null => {
    const a = lookup(code);
    return a ? { code: a.iata, city: city || a.city, lat: a.lat, lon: a.lon } : null;
  };

  for (const f of sorted) {
    const upcoming = new Date(f.arrival).getTime() >= now;
    const a = point(f.from.code, f.from.city), b = point(f.to.code, f.to.city);
    if (a && b) {
      // One line per airport pair, whichever direction it was flown.
      const key = [a.code, b.code].sort().join('-');
      const r = routes.get(key);
      if (r) {
        if (!upcoming) r.count++;
        r.upcoming &&= upcoming;
      } else routes.set(key, { from: a, to: b, count: upcoming ? 0 : 1, upcoming });
    }
    if (upcoming) continue;
    const d = a && b ? haversineKm(a.lat, a.lon, b.lat, b.lon) : f.distanceKm;
    km += d;
    minutes += f.durationMinutes;
    if (!longest || d > longest.km) longest = { from: f.from.code, to: f.to.code, km: Math.round(d) };
    for (const code of [f.from.code, f.to.code]) {
      airports.add(code);
      const cc = lookup(code)?.country;
      if (cc && !countries.includes(cc)) countries.push(cc);
    }
    cities.set(f.to.city, (cities.get(f.to.city) ?? 0) + 1);
  }

  let topCity: TravelSummary['topCity'];
  for (const [city, count] of cities) if (!topCity || count > topCity.count) topCity = { city, count };

  return {
    flights: flown.length,
    km: Math.round(km),
    hours: Math.round(minutes / 60),
    countries,
    airports: airports.size,
    laps: km / 40_075,
    longest,
    topCity,
    routes: [...routes.values()],
  };
}

/** 🇷🇴 from "RO". */
export function flagEmoji(cc: string): string {
  if (!/^[A-Za-z]{2}$/.test(cc)) return '🏳️';
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Points along the great circle between two airports, for drawing a curved route. */
export function greatCircle(a: { lat: number; lon: number }, b: { lat: number; lon: number }, steps = 48): [number, number][] {
  const r = Math.PI / 180;
  const [φ1, λ1, φ2, λ2] = [a.lat * r, a.lon * r, b.lat * r, b.lon * r];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2));
  if (d < 1e-6) return [[a.lat, a.lon], [b.lat, b.lon]];
  const out: [number, number][] = [];
  let prevLon: number | undefined;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const A = Math.sin((1 - t) * d) / Math.sin(d), B = Math.sin(t * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    let lon = Math.atan2(y, x) / r;
    // Keep the line continuous across the antimeridian instead of jumping across the map.
    if (prevLon !== undefined) while (lon - prevLon > 180) lon -= 360;
    if (prevLon !== undefined) while (prevLon - lon > 180) lon += 360;
    prevLon = lon;
    out.push([Math.atan2(z, Math.sqrt(x * x + y * y)) / r, lon]);
  }
  return out;
}
