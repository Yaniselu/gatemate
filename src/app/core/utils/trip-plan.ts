import type { Sight } from '../services/explore.service';
import type { Holiday } from '../services/explore.service';
import type { WeatherDay } from '../services/destination.service';

export interface PlanStop {
  kind: 'sight' | 'lunch' | 'arrive' | 'leave' | 'free';
  time: string;
  sight?: Sight;
  travelMin?: number;
  travelMode?: 'walk' | 'ride';
  near?: string;
}

export interface PlanDay {
  date: string;
  index: number;
  role: 'arrival' | 'full' | 'departure' | 'single';
  stops: PlanStop[];
  weather?: WeatherDay;
  holiday?: Holiday;
  walkKm: number;
}

export interface PlanInput {
  sights: Sight[];
  tz: string;
  arrival?: Date;
  departure?: Date;
  days?: number;
  weather?: WeatherDay[];
  holidays?: Holiday[];
}

const DAY_START = 9.5;
const VISIT_H = 1.5;
const LUNCH_H = 1;
const WALK_KMH = 4.5;
const CLUSTER_KM = 3;

export function buildPlan(input: PlanInput): PlanDay[] {
  const tz = input.tz;
  const dates = tripDates(input);
  if (!dates.length || !input.sights.length) return [];

  const pool = [...input.sights];
  const out: PlanDay[] = [];

  dates.forEach((date, i) => {
    const single = dates.length === 1 && !!input.arrival && !!input.departure;
    const role: PlanDay['role'] = single ? 'single' : i === 0 && input.arrival ? 'arrival' : i === dates.length - 1 && input.departure ? 'departure' : 'full';

    let start = DAY_START;
    let end = 19;
    if ((role === 'arrival' || role === 'single') && input.arrival) start = Math.max(DAY_START, hourIn(input.arrival, tz) + 1.5);
    if ((role === 'departure' || role === 'single') && input.departure) end = Math.min(end, hourIn(input.departure, tz) - 3);

    const room = end - start;
    const lunch = start <= 12 && end >= 14.5;
    const cap = Math.max(0, Math.min(4, Math.floor((room - (lunch ? LUNCH_H : 0) + 0.3) / (VISIT_H + 0.4))));
    const picked = pickCluster(pool, cap);

    const stops: PlanStop[] = [];
    if (role === 'arrival' || role === 'single') stops.push({ kind: 'arrive', time: fmt(start - 1.5) });

    let clock = start;
    let walkKm = 0;
    let lunched = !lunch;
    picked.forEach((s, j) => {
      if (j > 0) {
        const km = distKm(picked[j - 1], s) * 1.25;
        const walk = (km / WALK_KMH) * 60;
        const ride = walk > 30;
        const min = Math.round(ride ? 10 + km * 3 : walk);
        clock += min / 60;
        if (!ride) walkKm += km;
        if (!lunched && clock >= 12.25) {
          stops.push({ kind: 'lunch', time: fmt(clock), near: picked[j - 1].name });
          clock += LUNCH_H;
          lunched = true;
        }
        stops.push({ kind: 'sight', time: fmt(clock), sight: s, travelMin: Math.max(3, min), travelMode: ride ? 'ride' : 'walk' });
      } else {
        stops.push({ kind: 'sight', time: fmt(clock), sight: s });
      }
      clock += VISIT_H;
    });
    if (!lunched && picked.length) stops.push({ kind: 'lunch', time: fmt(Math.max(clock, 12.5)), near: picked[picked.length - 1].name });
    if (!picked.length && cap > 0) stops.push({ kind: 'free', time: fmt(start) });

    if ((role === 'departure' || role === 'single') && input.departure) stops.push({ kind: 'leave', time: fmt(hourIn(input.departure, tz) - 2.5) });

    out.push({
      date,
      index: i + 1,
      role,
      stops,
      weather: input.weather?.find((w) => w.date === date),
      holiday: input.holidays?.find((h) => h.date === date),
      walkKm: Math.round(walkKm * 10) / 10,
    });
  });

  return out;
}

export function routeUrl(day: PlanDay): string | null {
  const pts = day.stops.filter((s) => s.sight).map((s) => `${s.sight!.lat},${s.sight!.lon}`);
  if (!pts.length) return null;
  if (pts.length === 1) return `https://www.google.com/maps/search/?api=1&query=${pts[0]}`;
  const mid = pts.slice(1, -1).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${pts[0]}&destination=${pts[pts.length - 1]}${mid ? '&waypoints=' + encodeURIComponent(mid) : ''}&travelmode=walking`;
}

function pickCluster(pool: Sight[], cap: number): Sight[] {
  if (!cap || !pool.length) return [];
  const seed = pool.shift()!;
  const day = [seed];
  while (day.length < cap && pool.length) {
    const last = day[day.length - 1];
    let best = -1;
    let bestKm = Infinity;
    pool.forEach((s, k) => {
      const km = Math.min(...day.map((d) => distKm(d, s))) + distKm(last, s) * 0.5;
      if (km < bestKm) {
        bestKm = km;
        best = k;
      }
    });
    if (best < 0 || distKm(last, pool[best]) > CLUSTER_KM * (day.length === 1 ? 2 : 1)) break;
    day.push(pool.splice(best, 1)[0]);
  }
  return order(day);
}

function order(list: Sight[]): Sight[] {
  if (list.length < 3) return list;
  const rest = list.slice(1);
  const route = [list[0]];
  while (rest.length) {
    const last = route[route.length - 1];
    rest.sort((a, b) => distKm(last, a) - distKm(last, b));
    route.push(rest.shift()!);
  }
  return route;
}

function tripDates(input: PlanInput): string[] {
  const tz = input.tz;
  if (input.arrival && input.departure && input.departure > input.arrival) {
    const out: string[] = [];
    const last = dayIn(input.departure, tz);
    let t = input.arrival.getTime();
    for (let n = 0; n < 14; n++) {
      const d = dayIn(new Date(t), tz);
      if (!out.includes(d)) out.push(d);
      if (d === last) break;
      t += 86_400_000;
    }
    if (out[out.length - 1] !== last && out.length < 14) out.push(last);
    return out;
  }
  const from = input.arrival ?? new Date(Date.now() + 86_400_000);
  const n = input.days ?? 3;
  return Array.from({ length: n }, (_, i) => dayIn(new Date(from.getTime() + i * 86_400_000), tz));
}

function dayIn(d: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function hourIn(d: Date, tz: string): number {
  try {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
    const h = +(p.find((x) => x.type === 'hour')?.value ?? 0);
    const m = +(p.find((x) => x.type === 'minute')?.value ?? 0);
    return h + m / 60;
  } catch {
    return d.getUTCHours() + d.getUTCMinutes() / 60;
  }
}

function fmt(h: number): string {
  const q = Math.round(Math.max(0, Math.min(23.99, h)) * 4) / 4;
  const hh = Math.floor(q);
  const mm = Math.round((q - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function distKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = Math.PI / 180;
  const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}
