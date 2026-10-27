import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AirportRecord } from './airport-db.service';

export type PoiKind = 'food' | 'pharmacy' | 'toilets' | 'money' | 'charging' | 'shop' | 'info';

export interface MapFeature {
  kind: 'gate' | 'terminal' | 'poi';
  ref: string;
  lat: number;
  lon: number;
  poi?: PoiKind;
}

const AMENITY: Record<string, PoiKind> = {
  cafe: 'food', restaurant: 'food', fast_food: 'food', bar: 'food', pharmacy: 'pharmacy', toilets: 'toilets',
  atm: 'money', bureau_de_change: 'money', charging_station: 'charging', information: 'info',
};

/**
 * Gate and terminal positions from OpenStreetMap (aeroway=gate / aeroway=terminal).
 * Coverage depends on the airport; the backend caches results for a day to respect Overpass fair use.
 */
@Injectable({ providedIn: 'root' })
export class GatesService {
  private http = inject(HttpClient);
  private cache = new Map<string, Promise<MapFeature[]>>();

  get(a: AirportRecord): Promise<MapFeature[]> {
    if (!this.cache.has(a.iata)) {
      const p = this.fetch(a).catch((e) => {
        // Don't cache failures and don't pretend the airport has no gates: let the page say it's offline.
        this.cache.delete(a.iata);
        throw e;
      });
      this.cache.set(a.iata, p);
    }
    return this.cache.get(a.iata)!;
  }

  private async fetch(a: AirportRecord): Promise<MapFeature[]> {
    if (!environment.useMocks) {
      return firstValueFrom(this.http.get<MapFeature[]>(`${environment.apiUrl}/airports/${a.iata}/map`));
    }
    const near = `(around:4000,${a.lat},${a.lon})`;
    const q = `[out:json][timeout:25];(node["aeroway"="gate"]${near};way["aeroway"="terminal"]${near};node["amenity"~"^(cafe|restaurant|fast_food|bar|pharmacy|toilets|atm|bureau_de_change|charging_station)$"]${near};node["shop"]["name"]${near};node["tourism"="information"]${near};);out center tags 400;`;
    const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (!r.ok) throw new Error('overpass ' + r.status);
    const j = await r.json();
    return (j.elements as { type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[])
      .map((e): MapFeature => {
        const t = e.tags ?? {};
        const lat = e.lat ?? e.center?.lat ?? 0;
        const lon = e.lon ?? e.center?.lon ?? 0;
        if (t['aeroway'] === 'gate') return { kind: 'gate', ref: t['ref'] ?? t['name'] ?? '', lat, lon };
        if (t['aeroway'] === 'terminal') return { kind: 'terminal', ref: t['name'] ?? t['ref'] ?? 'Terminal', lat, lon };
        const poi: PoiKind = AMENITY[t['amenity'] ?? ''] ?? (t['tourism'] === 'information' ? 'info' : 'shop');
        const fallback = { food: 'Café', pharmacy: 'Pharmacy', toilets: 'Toilets', money: t['amenity'] === 'atm' ? 'ATM' : 'Currency exchange', charging: 'Charging', shop: 'Shop', info: 'Information' }[poi];
        return { kind: 'poi', poi, ref: t['name'] ?? fallback, lat, lon };
      })
      .filter((f) => f.ref && f.lat);
  }
}
