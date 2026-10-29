import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Flight } from '../models';
import { publicFetch } from '../utils/public-fetch';
import { AirportDbService, haversineKm } from './airport-db.service';

export type LivePhase = 'scheduled' | 'taxiing' | 'airborne' | 'landed' | 'no-signal';

export interface LiveState {
  phase: LivePhase;
  lat?: number;
  lon?: number;
  /** Feet; 0 on the ground. */
  altitudeFt?: number;
  speedKmh?: number;
  /** Degrees from north. */
  heading?: number;
  /** 0–1 of the route flown. */
  progress?: number;
  /** Estimated landing (epoch ms) from the remaining distance and ground speed. */
  eta?: number;
  aircraft?: string;
  registration?: string;
  callsign?: string;
  updatedAt: number;
}

/** ADS-B Exchange v2-compatible community networks (free, no key). */
const ADSB = ['https://opendata.adsb.fi/api/v2/callsign/', 'https://api.adsb.lol/v2/callsign/'];

interface Aircraft {
  flight?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | 'ground';
  gs?: number;
  track?: number;
  t?: string;
  r?: string;
  seen_pos?: number;
}

/**
 * Where the plane is right now, from community ADS-B receivers (the same data flight-tracking sites use).
 * The airline's radio callsign is its ICAO code + flight number (W6 3121 → WZZ3121). Coverage is excellent over
 * Europe and North America and patchy over oceans; with no signal we say so rather than guess.
 */
@Injectable({ providedIn: 'root' })
export class LiveFlightService {
  private http = inject(HttpClient);
  private db = inject(AirportDbService);
  private airlines: Promise<Map<string, string[]>> | null = null;

  /** Whether it's worth asking: from an hour before departure until two hours after the scheduled landing. */
  inWindow(f: Flight, now = Date.now()): boolean {
    return now > +new Date(f.departure) - 3600_000 && now < +new Date(f.arrival) + 2 * 3600_000;
  }

  async get(f: Flight): Promise<LiveState> {
    const now = Date.now();
    if (now < +new Date(f.departure) - 3600_000) return { phase: 'scheduled', updatedAt: now };
    const ac = await this.find(f).catch(() => null);
    if (!ac || ac.lat === undefined || ac.lon === undefined) {
      return { phase: now > +new Date(f.arrival) + 30 * 60_000 ? 'landed' : now < +new Date(f.departure) ? 'scheduled' : 'no-signal', updatedAt: now };
    }
    await this.db.load().catch(() => {});
    const from = this.db.get(f.from.code), to = this.db.get(f.to.code);
    const ground = ac.alt_baro === 'ground' || (ac.alt_baro ?? 0) < 200;
    const kmh = (ac.gs ?? 0) * 1.852;
    let progress: number | undefined;
    let eta: number | undefined;
    let phase: LivePhase = ground ? 'taxiing' : 'airborne';
    if (from && to) {
      const total = haversineKm(from.lat, from.lon, to.lat, to.lon);
      const left = haversineKm(ac.lat, ac.lon, to.lat, to.lon);
      progress = Math.min(1, Math.max(0, 1 - left / Math.max(total, 1)));
      if (ground && left < 8) phase = 'landed';
      // Remaining distance at current speed, plus ~12 min for descent and approach.
      if (!ground && kmh > 150) eta = now + (left / kmh) * 3600_000 + 12 * 60_000;
    }
    return {
      phase,
      lat: ac.lat,
      lon: ac.lon,
      altitudeFt: ground ? 0 : Math.round(Number(ac.alt_baro) || 0),
      speedKmh: Math.round(kmh),
      heading: ac.track,
      progress,
      eta,
      aircraft: ac.t,
      registration: ac.r,
      callsign: ac.flight?.trim(),
      updatedAt: now,
    };
  }

  /** ICAO callsigns to try for a flight ("W6 3121" → ["WZZ3121"]). */
  async callsigns(f: Flight): Promise<string[]> {
    const map = await (this.airlines ??= fetch('data/airlines.json')
      .then((r) => r.json() as Promise<[string, string[], string][]>)
      .then((rows) => new Map(rows.map(([iata, icao]) => [iata, icao])))
      .catch(() => new Map<string, string[]>()));
    const m = f.number.replace(/\s+/g, '').match(/^([A-Z0-9]{2})(\d{1,4})([A-Z]?)$/);
    if (!m) return [];
    const num = String(Number(m[2])) + m[3];
    return (map.get(m[1]) ?? []).map((icao) => icao + num);
  }

  private async find(f: Flight): Promise<Aircraft | null> {
    const signs = await this.callsigns(f);
    for (const cs of signs) {
      for (const base of ADSB) {
        try {
          const r = await publicFetch(base + cs, { timeoutMs: 8000 });
          if (r.status !== 200) continue;
          const list = (JSON.parse(r.text) as { ac?: Aircraft[] }).ac ?? [];
          const hit = list.filter((a) => a.lat !== undefined).sort((a, b) => (a.seen_pos ?? 99) - (b.seen_pos ?? 99))[0];
          if (hit) return hit;
          break; // the network answered: this callsign just isn't flying
        } catch {
          /* try the next network */
        }
      }
    }
    // Our server asks the same networks (it also turns take-off and landing into alerts for the whole group).
    if (environment.useMocks) return null;
    try {
      return await firstValueFrom(this.http.get<Aircraft | null>(`${environment.apiUrl}/flights/${encodeURIComponent(f.id)}/live`));
    } catch {
      return null;
    }
  }
}
