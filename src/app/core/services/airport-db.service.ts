import { Injectable, signal } from '@angular/core';
import { locale } from '../i18n/i18n.service';

export interface AirportRecord {
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  tz: string;
  size: 'L' | 'M' | 'S';
}

export interface CountryFacts {
  name: string;
  native: string;
  capital: string;
  continent: string;
  currency: string[];
  phone: number[];
  languages: string[];
  plugs?: string;
  volts?: number;
  left?: boolean;
  sos?: { general?: string; police?: string; ambulance?: string; fire?: string };
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Every airport with an IATA code and scheduled service (~5,300, OurAirports + IANA time zones),
 * shipped as a static file and loaded lazily the first time it is needed.
 */
@Injectable({ providedIn: 'root' })
export class AirportDbService {
  private airports: AirportRecord[] = [];
  private byCode = new Map<string, AirportRecord>();
  private countries: Record<string, CountryFacts> = {};
  private loading: Promise<void> | null = null;
  readonly ready = signal(false);

  load(): Promise<void> {
    this.loading ??= (async () => {
      const [a, c] = await Promise.all([fetch('data/airports.json').then((r) => r.json()), fetch('data/countries.json').then((r) => r.json())]);
      this.airports = (a.airports as unknown[][]).map(([iata, icao, name, city, country, lat, lon, tz, size]) => ({
        iata, icao, name, city, country, lat, lon, tz, size,
      }) as AirportRecord);
      this.byCode = new Map(this.airports.map((x) => [x.iata, x]));
      this.countries = c;
      this.ready.set(true);
    })().catch((e) => {
      this.loading = null;
      throw e;
    });
    return this.loading;
  }

  get(iata: string): AirportRecord | undefined {
    return this.byCode.get(iata.toUpperCase());
  }

  country(code: string): CountryFacts | undefined {
    return this.countries[code];
  }

  /** Country name in the app's language (the bundled English name when the browser has no translation). */
  countryName(code: string): string {
    const en = this.countries[code]?.name ?? code;
    if (locale().startsWith('en') || !/^[A-Z]{2}$/.test(code)) return en;
    try {
      this.regionNames ??= new Intl.DisplayNames([locale()], { type: 'region' });
      return this.regionNames.of(code) ?? en;
    } catch {
      return en;
    }
  }
  private regionNames?: Intl.DisplayNames;

  /** Code match first, then city, then airport name / country; larger airports rank higher. */
  search(query: string, limit = 25): AirportRecord[] {
    const q = fold(query.trim());
    if (!q) return this.airports.filter((a) => a.size === 'L').slice(0, limit);
    const score = (a: AirportRecord) => {
      const code = a.iata.toLowerCase();
      if (code === q) return 0;
      if (a.icao.toLowerCase() === q) return 1;
      const city = fold(a.city);
      if (city.startsWith(q)) return 2;
      if (fold(a.name).includes(q)) return 3;
      if (fold(this.countryName(a.country)).startsWith(q)) return 4;
      if (code.startsWith(q)) return 5;
      return 99;
    };
    const rank = { L: 0, M: 0.3, S: 0.6 };
    return this.airports
      .map((a) => ({ a, s: score(a) + rank[a.size] }))
      .filter((x) => x.s < 99)
      .sort((x, y) => x.s - y.s)
      .slice(0, limit)
      .map((x) => x.a);
  }

  nearest(lat: number, lon: number): { airport: AirportRecord; km: number } | null {
    let best: AirportRecord | null = null;
    let bestKm = Infinity;
    for (const a of this.airports) {
      const km = haversineKm(lat, lon, a.lat, a.lon);
      if (km < bestKm) [best, bestKm] = [a, km];
    }
    return best ? { airport: best, km: bestKm } : null;
  }
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
