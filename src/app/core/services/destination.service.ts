import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AirportDbService, AirportRecord, CountryFacts } from './airport-db.service';
import { deviceCached, publicFetch, publicJson } from '../utils/public-fetch';

export interface WeatherDay {
  date: string;
  code: number;
  max: number;
  min: number;
}

export interface DestinationInfo {
  airport: AirportRecord;
  country?: CountryFacts;
  summary?: { title: string; description?: string; extract: string; pageUrl: string; coords?: { lat: number; lon: number } };
  photo?: { url: string; credit: string; link: string };
  weather?: { temp: number; code: number; wind: number; days: WeatherDay[] };
  fx?: { base: string; currency: string; rate: number; date: string };
  offline?: boolean;
}

export function weatherLabel(code: number): { label: string; icon: string } {
  if (code === 0) return { label: 'Clear', icon: 'sunny' };
  if (code <= 2) return { label: 'Partly cloudy', icon: 'partly-sunny' };
  if (code === 3) return { label: 'Overcast', icon: 'cloud' };
  if (code <= 48) return { label: 'Fog', icon: 'cloud' };
  if (code <= 57) return { label: 'Drizzle', icon: 'rainy' };
  if (code <= 67) return { label: 'Rain', icon: 'rainy' };
  if (code <= 77) return { label: 'Snow', icon: 'snow' };
  if (code <= 82) return { label: 'Showers', icon: 'rainy' };
  if (code <= 86) return { label: 'Snow showers', icon: 'snow' };
  return { label: 'Thunderstorm', icon: 'thunderstorm' };
}

@Injectable({ providedIn: 'root' })
export class DestinationService {
  private http = inject(HttpClient);
  private db = inject(AirportDbService);
  private cache = new Map<string, Promise<DestinationInfo>>();
  private wikiCache = new Map<string, Promise<Awaited<ReturnType<DestinationService['wiki']>>>>();

  async photo(iata: string): Promise<DestinationInfo['photo']> {
    await this.db.load();
    const a = this.db.get(iata);
    if (!a) return undefined;
    return deviceCached(`photo_${iata}`, 30 * 86_400_000, async () => {
      const p = (await this.wikiFor(a))?.photo;
      if (!p) throw new Error('no photo');
      return p;
    }).catch(() => undefined);
  }

  private wikiFor(a: AirportRecord) {
    if (!this.wikiCache.has(a.iata)) this.wikiCache.set(a.iata, this.wiki(a, this.db.country(a.country)).catch(() => undefined));
    return this.wikiCache.get(a.iata)!;
  }

  forget(iata: string) {
    for (const k of [...this.cache.keys()]) if (k.startsWith(iata + '|')) this.cache.delete(k);
  }

  get(iata: string, homeCurrency = 'EUR'): Promise<DestinationInfo> {
    const key = `${iata}|${homeCurrency}`;
    if (!this.cache.has(key)) {
      const p = this.load(iata, homeCurrency).catch((e) => {
        this.cache.delete(key);
        throw e;
      });
      this.cache.set(key, p);
    }
    return this.cache.get(key)!;
  }

  private async load(iata: string, home: string): Promise<DestinationInfo> {
    await this.db.load();
    const airport = this.db.get(iata);
    if (!airport) throw new Error('Unknown airport');
    const country = this.db.country(airport.country);
    const info = await deviceCached(`dest_${iata}_${home}`, 3 * 3600_000, () => this.fetchInfo(iata, home)).catch(
      (): DestinationInfo => ({ airport, country, offline: true }),
    );
    return { ...info, airport, country: info.country ?? country };
  }

  private async fetchInfo(iata: string, home: string): Promise<DestinationInfo> {
    const airport = this.db.get(iata);
    if (!airport) throw new Error('Unknown airport');
    const country = this.db.country(airport.country);
    const [wiki, weather, fx] = await Promise.all([
      this.wikiFor(airport),
      this.weather(airport).catch(() => undefined),
      this.fx(home, country?.currency?.[0]).catch(() => undefined),
    ]);
    if (!wiki && !weather && !environment.useMocks) {
      const viaServer = await firstValueFrom(
        this.http.get<DestinationInfo>(`${environment.apiUrl}/destinations/${encodeURIComponent(iata)}`, { params: { home } }),
      ).catch(() => null);
      if (viaServer) return { ...viaServer, airport, country: viaServer.country ?? country };
    }
    if (!wiki && !weather && !fx) throw new Error('offline');
    return { airport, country, summary: wiki?.summary, photo: wiki?.photo, weather, fx };
  }

  private async wiki(a: AirportRecord, c?: CountryFacts) {
    const titles = [a.city, c ? `${a.city}, ${c.name}` : ''].filter(Boolean);
    for (const t of titles) {
      const r = await publicFetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t.replace(/ /g, '_'))}`, { timeoutMs: 10_000 });
      if (r.status !== 200) continue;
      const j = JSON.parse(r.text);
      if (j.type === 'disambiguation' || !j.extract) continue;
      const orig = j.originalimage as { source: string; width: number } | undefined;
      const img = orig && orig.width <= 1280 ? orig.source : (j.thumbnail?.source as string | undefined)?.replace(/\/\d+px-/, '/1280px-') ?? orig?.source;
      const pageUrl = j.content_urls?.mobile?.page ?? j.content_urls?.desktop?.page;
      return {
        summary: { title: j.title, description: j.description, extract: j.extract, pageUrl, coords: j.coordinates ? { lat: j.coordinates.lat, lon: j.coordinates.lon } : undefined },
        photo: img ? { url: img, credit: 'Photo: Wikipedia / Wikimedia Commons', link: pageUrl } : undefined,
      };
    }
    return undefined;
  }

  private async weather(a: AirportRecord) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${a.lat}&longitude=${a.lon}&current=temperature_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=5&timezone=${encodeURIComponent(a.tz)}`;
    const j = await publicJson<any>(url, { timeoutMs: 10_000 }); // eslint-disable-line @typescript-eslint/no-explicit-any
    return {
      temp: Math.round(j.current.temperature_2m),
      code: j.current.weather_code,
      wind: Math.round(j.current.wind_speed_10m),
      days: (j.daily.time as string[]).map((date, i) => ({ date, code: j.daily.weather_code[i], max: Math.round(j.daily.temperature_2m_max[i]), min: Math.round(j.daily.temperature_2m_min[i]) })),
    };
  }

  private async fx(base: string, currency?: string) {
    if (!currency || currency === base) return undefined;
    const j = await publicJson<{ rates?: Record<string, number>; date: string }>(`https://api.frankfurter.app/latest?from=${base}&to=${currency}`, { timeoutMs: 8000 });
    const rate = j.rates?.[currency];
    return rate ? { base, currency, rate, date: j.date } : undefined;
  }
}
