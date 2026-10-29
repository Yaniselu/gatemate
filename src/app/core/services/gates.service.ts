import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { environment } from '../../../environments/environment';
import { AirportRecord } from './airport-db.service';
import { AMENITY_RE, classify, fallbackName, PoiKind } from '../data/airport-poi';
import { publicFetch } from '../utils/public-fetch';

export type { PoiKind } from '../data/airport-poi';

export interface MapFeature {
  id?: string;
  kind: 'gate' | 'terminal' | 'poi' | 'aerodrome' | 'runway' | 'taxiway' | 'apron';
  ref: string;
  lat: number;
  lon: number;
  poi?: PoiKind;
  /** Terminal the place is in (from the terminal outlines), e.g. "Terminal 2". */
  terminal?: string;
  level?: string;
  /** OSM opening_hours. */
  hours?: string;
  brand?: string;
  /** Cuisine, operator or shop type. */
  detail?: string;
  /** Outline rings (terminals, aprons, airport boundary), [lat, lon]. */
  outline?: [number, number][][];
  /** Centre line of a runway or taxiway, [lat, lon]. */
  line?: [number, number][];
  /** Real width in metres (runways, taxiways), so the drawing scales with zoom. */
  width?: number;
}

interface Cached {
  v: 3;
  savedAt: number;
  features: MapFeature[];
}

/** Public Overpass instances, raced with a short head start each so one slow mirror doesn't stall the page. */
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const STAGGER_MS = 5000;
const FRESH_MS = 3 * 86_400_000;
const KEEP_MS = 30 * 86_400_000;

type OsmElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  members?: { role: string; geometry?: { lat: number; lon: number }[] }[];
};

/**
 * Everything inside an airport from OpenStreetMap: terminals (with outlines), gates and every mapped café,
 * restaurant, shop, toilet, ATM, lounge, pharmacy, transport link… Queried inside the airport's own boundary,
 * kept on the phone for offline use, refreshed every few days.
 */
@Injectable({ providedIn: 'root' })
export class GatesService {
  private http = inject(HttpClient);
  private memory = new Map<string, Promise<MapFeature[]>>();
  /** Why the last network load failed, for the error message. */
  lastError = '';

  get(a: AirportRecord): Promise<MapFeature[]> {
    if (!this.memory.has(a.iata)) {
      const p = this.load(a).catch((e) => {
        this.memory.delete(a.iata);
        throw e;
      });
      this.memory.set(a.iata, p);
    }
    return this.memory.get(a.iata)!;
  }

  /** Ignores the saved copy (pull to refresh). */
  refresh(a: AirportRecord): Promise<MapFeature[]> {
    this.memory.delete(a.iata);
    const p = this.network(a).then(async (f) => {
      await this.save(a.iata, f);
      return f;
    });
    this.memory.set(a.iata, p.catch(() => this.load(a)));
    return p;
  }

  private async load(a: AirportRecord): Promise<MapFeature[]> {
    const cached = await this.read(a.iata);
    if (cached && Date.now() - cached.savedAt < KEEP_MS) {
      if (Date.now() - cached.savedAt > FRESH_MS) {
        void this.network(a)
          .then((f) => this.save(a.iata, f))
          .catch(() => {});
      }
      return cached.features;
    }
    try {
      const f = await this.network(a);
      await this.save(a.iata, f);
      return f;
    } catch (e) {
      if (cached) return cached.features;
      throw e;
    }
  }

  /** Straight from OpenStreetMap on the phone; our server (same query) is the fallback. */
  private async network(a: AirportRecord): Promise<MapFeature[]> {
    try {
      const inside = await this.overpass(areaQuery(a));
      const features = parse(inside);
      if (features.length) return features;
      // The airport boundary isn't mapped (or has no IATA/ICAO tag): search around it instead.
      return parse(await this.overpass(aroundQuery(a)));
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e);
      if (environment.useMocks) throw e;
      return firstValueFrom(this.http.get<MapFeature[]>(`${environment.apiUrl}/airports/${a.iata}/map`));
    }
  }

  private overpass(query: string): Promise<OsmElement[]> {
    return new Promise((resolve, reject) => {
      const ctl = new AbortController();
      const started = new Set<number>();
      const timers: ReturnType<typeof setTimeout>[] = [];
      let failed = 0;
      let done = false;
      const start = async (i: number): Promise<void> => {
        if (done || started.has(i) || i >= OVERPASS.length) return;
        started.add(i);
        try {
          const r = await publicFetch(OVERPASS[i], { method: 'POST', form: { data: query }, timeoutMs: 50_000, signal: ctl.signal });
          if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
          const j = JSON.parse(r.text) as { elements?: OsmElement[] };
          if (!Array.isArray(j.elements)) throw new Error('unexpected response');
          if (done) return;
          done = true;
          timers.forEach(clearTimeout);
          ctl.abort();
          resolve(j.elements);
        } catch (e) {
          if (done) return;
          if (++failed === OVERPASS.length) {
            done = true;
            reject(new Error(`OpenStreetMap is unreachable (${e instanceof Error ? e.message : e})`));
          } else void start(i + 1); // a mirror failing early lets the next one go straight away
        }
      };
      OVERPASS.forEach((_, i) => timers.push(setTimeout(() => void start(i), i * STAGGER_MS)));
    });
  }

  // ---- device copy -------------------------------------------------------------------------------

  private async read(iata: string): Promise<Cached | null> {
    try {
      let raw: string | null;
      if (Capacitor.isNativePlatform()) {
        raw = (await Filesystem.readFile({ path: `osm/${iata}.json`, directory: Directory.Data, encoding: Encoding.UTF8 })).data as string;
      } else {
        raw = localStorage.getItem(`gm_osm_${iata}`);
      }
      const c = raw ? (JSON.parse(raw) as Cached) : null;
      return c?.v === 3 && Array.isArray(c.features) ? c : null;
    } catch {
      return null;
    }
  }

  private async save(iata: string, features: MapFeature[]): Promise<void> {
    if (!features.length) return;
    const data = JSON.stringify({ v: 3, savedAt: Date.now(), features } satisfies Cached);
    try {
      if (Capacitor.isNativePlatform()) {
        await Filesystem.writeFile({ path: `osm/${iata}.json`, directory: Directory.Data, encoding: Encoding.UTF8, data, recursive: true });
      } else {
        localStorage.setItem(`gm_osm_${iata}`, data);
      }
    } catch {
      /* storage full or blocked: the data still shows, it just isn't kept */
    }
  }
}

// ---- Overpass ----------------------------------------------------------------------------------

function selectors(scope: string): string {
  return [
    `nwr["aeroway"="gate"]${scope};`,
    `nwr["amenity"~"^(${AMENITY_RE})$"]${scope};`,
    `nwr["shop"]${scope};`,
    `nwr["tourism"~"^(information|hotel)$"]${scope};`,
    `nwr["emergency"="defibrillator"]${scope};`,
    `nwr["public_transport"="station"]${scope};`,
    `nwr["railway"~"^(station|halt)$"]${scope};`,
    `nwr["leisure"="playground"]${scope};`,
  ].join('');
}

function areaQuery(a: AirportRecord): string {
  const ids = [`["iata"="${a.iata}"]`, a.icao ? `["icao"="${a.icao}"]` : ''].filter(Boolean);
  const airport = ids.map((t) => `way["aeroway"="aerodrome"]${t};relation["aeroway"="aerodrome"]${t};`).join('');
  return `[out:json][timeout:60];(${airport})->.ap;.ap out geom tags;.ap map_to_area->.a;(${selectors('(area.a)')});out center tags;${shapes('(area.a)')}`;
}

function aroundQuery(a: AirportRecord): string {
  const near = `(around:3000,${a.lat},${a.lon})`;
  return `[out:json][timeout:60];(${selectors(near)});out center tags;${shapes(near)}`;
}

/** Shapes for the drawn plan: terminals, aprons, runways and taxiways, with geometry. */
function shapes(scope: string): string {
  return `(way["aeroway"="terminal"]${scope};relation["aeroway"="terminal"]${scope};way["building"="terminal"]${scope};way["aeroway"~"^(runway|taxiway|apron)$"]${scope};relation["aeroway"="apron"]${scope};);out geom tags;`;
}

/** Turns Overpass elements into map features, placing each facility in the terminal that contains it. */
export function parse(elements: OsmElement[]): MapFeature[] {
  const terminals: MapFeature[] = [];
  const shapes: MapFeature[] = [];
  const rest: OsmElement[] = [];
  const seen = new Set<string>();
  for (const e of elements) {
    const key = `${e.type}${e.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const t = e.tags ?? {};
    const aw = t['aeroway'];
    const hasShape = !!e.geometry || !!e.members?.some((m) => m.geometry);
    if (hasShape && (aw === 'terminal' || t['building'] === 'terminal' || aw === 'aerodrome' || aw === 'apron')) {
      const rings = (e.geometry ? [e.geometry] : (e.members ?? []).filter((m) => m.role !== 'inner' && m.geometry?.length).map((m) => m.geometry!))
        .map((g) => simplify(g.map((p) => [round(p.lat), round(p.lon)] as [number, number])))
        .filter((r) => r.length > 2);
      if (!rings.length) continue;
      const pts = rings.flat();
      const lat = pts.reduce((s, p) => s + p[0], 0) / pts.length, lon = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      if (aw === 'aerodrome') shapes.push({ id: key, kind: 'aerodrome', ref: t['name'] ?? '', lat, lon, outline: rings });
      else if (aw === 'apron') shapes.push({ id: key, kind: 'apron', ref: '', lat, lon, outline: rings });
      else terminals.push({ id: key, kind: 'terminal', ref: terminalName(t), lat, lon, outline: rings });
    } else if (e.geometry && (aw === 'runway' || aw === 'taxiway')) {
      const line = simplify(e.geometry.map((p) => [round(p.lat), round(p.lon)] as [number, number]));
      const mid = line[Math.floor(line.length / 2)];
      const width = parseFloat(t['width'] ?? '') || (aw === 'runway' ? 45 : 18);
      shapes.push({ id: key, kind: aw, ref: aw === 'runway' ? t['ref'] ?? '' : '', lat: mid[0], lon: mid[1], line, width });
    } else if (!hasShape || e.center || e.lat !== undefined) rest.push(e);
  }

  const out: MapFeature[] = [...shapes, ...terminals];
  for (const e of rest) {
    const t = e.tags ?? {};
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    if (lat === undefined || lon === undefined) continue;
    if (t['aeroway'] === 'terminal' || t['building'] === 'terminal') {
      // Terminal mapped only as a point: still shown and named on the plan.
      out.push({ id: `${e.type}${e.id}`, kind: 'terminal', ref: terminalName(t), lat, lon });
      continue;
    }
    const terminal = t['terminal'] ? terminalLabel(t['terminal']) : terminals.find((x) => x.outline?.some((r) => inside(lat, lon, r)))?.ref;
    const base = { id: `${e.type}${e.id}`, lat, lon, terminal, level: t['level'] || undefined };
    if (t['aeroway'] === 'gate') {
      const ref = (t['ref'] || t['name'] || '').trim();
      if (ref) out.push({ ...base, kind: 'gate', ref });
      continue;
    }
    const poi = classify(t);
    if (!poi) continue;
    const name = (t['name'] || t['brand'] || '').trim();
    // Unnamed shops/parking spaces are noise; unnamed toilets or ATMs are exactly what people look for.
    if (!name && (poi === 'shop' || poi === 'parking' || poi === 'hotel')) continue;
    const cuisine = t['cuisine']?.split(';').map((c) => c.trim().replace(/_/g, ' ')).join(', ');
    const detail = (cuisine ? cuisine.charAt(0).toUpperCase() + cuisine.slice(1) : '') || t['operator'] || undefined;
    out.push({ ...base, kind: 'poi', poi, ref: name || fallbackName(poi, t), hours: t['opening_hours'] || undefined, brand: t['brand'] || undefined, detail });
  }
  return out;
}

/** ~10 cm precision is plenty and keeps the saved copy small. */
function round(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

/** Douglas–Peucker: drops points that change the shape by less than ~1 m. */
function simplify(pts: [number, number][], eps = 0.00001): [number, number][] {
  if (pts.length < 4) return pts;
  const [f, l] = [pts[0], pts[pts.length - 1]];
  // Closed ring: simplify it as an open path, then close it again.
  if (f[0] === l[0] && f[1] === l[1]) return [...simplify(pts.slice(0, -1), eps), f];
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ay, ax] = pts[a], [by, bx] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-12;
    let max = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][1] - dx * pts[i][0] + bx * ay - by * ax) / len;
      if (d > max) [max, idx] = [d, i];
    }
    if (max > eps && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

function terminalName(t: Record<string, string>): string {
  if (t['name']) return t['name'];
  if (t['ref']) return terminalLabel(t['ref']);
  return 'Terminal';
}

function terminalLabel(ref: string): string {
  return /^t?\d+[a-z]?$/i.test(ref.trim()) ? `Terminal ${ref.trim().replace(/^t/i, '')}` : ref.trim();
}

/** Ray casting, ring as [lat, lon]. */
function inside(lat: number, lon: number, ring: [number, number][]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
