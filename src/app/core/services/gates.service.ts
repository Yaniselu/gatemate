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
  kind: 'gate' | 'terminal' | 'poi';
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
  /** Terminal outline rings, [lat, lon]. */
  outline?: [number, number][][];
}

interface Cached {
  v: 2;
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
      return c?.v === 2 && Array.isArray(c.features) ? c : null;
    } catch {
      return null;
    }
  }

  private async save(iata: string, features: MapFeature[]): Promise<void> {
    if (!features.length) return;
    const data = JSON.stringify({ v: 2, savedAt: Date.now(), features } satisfies Cached);
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
  return `[out:json][timeout:60];(${airport})->.ap;.ap map_to_area->.a;(${selectors('(area.a)')});out center tags;(way["aeroway"="terminal"](area.a);relation["aeroway"="terminal"](area.a););out geom tags;`;
}

function aroundQuery(a: AirportRecord): string {
  const near = `(around:3000,${a.lat},${a.lon})`;
  return `[out:json][timeout:60];(${selectors(near)});out center tags;(way["aeroway"="terminal"]${near};relation["aeroway"="terminal"]${near};);out geom tags;`;
}

/** Turns Overpass elements into map features, placing each facility in the terminal that contains it. */
export function parse(elements: OsmElement[]): MapFeature[] {
  const terminals: MapFeature[] = [];
  const rest: OsmElement[] = [];
  const seen = new Set<string>();
  for (const e of elements) {
    const key = `${e.type}${e.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const t = e.tags ?? {};
    if (t['aeroway'] === 'terminal') {
      const rings = e.geometry ? [e.geometry.map((p) => [p.lat, p.lon] as [number, number])]
        : (e.members ?? []).filter((m) => m.role !== 'inner' && m.geometry?.length).map((m) => m.geometry!.map((p) => [p.lat, p.lon] as [number, number]));
      if (!rings.length) continue;
      const pts = rings.flat();
      const lat = pts.reduce((s, p) => s + p[0], 0) / pts.length, lon = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      terminals.push({ id: key, kind: 'terminal', ref: terminalName(t), lat, lon, outline: rings });
    } else rest.push(e);
  }

  const out: MapFeature[] = [...terminals];
  for (const e of rest) {
    const t = e.tags ?? {};
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    if (lat === undefined || lon === undefined) continue;
    const terminal = t['terminal'] ? terminalLabel(t['terminal']) : terminals.find((x) => x.outline!.some((r) => inside(lat, lon, r)))?.ref;
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
