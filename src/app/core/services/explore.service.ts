import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { deviceCached, publicFetch } from '../utils/public-fetch';

export interface Sight {
  id: string;
  name: string;
  description?: string;
  image?: string;
  lat: number;
  lon: number;
  distanceKm: number;
  wikipedia?: string;
}

export interface Holiday {
  date: string;
  localName: string;
  name: string;
  national: boolean;
}

@Injectable({ providedIn: 'root' })
export class ExploreService {
  private http = inject(HttpClient);
  private sightsCache = new Map<string, Promise<Sight[]>>();
  private holidayCache = new Map<string, Promise<Holiday[]>>();

  sights(iata: string, lat: number, lon: number): Promise<Sight[]> {
    if (!this.sightsCache.has(iata)) {
      const p = deviceCached(`sights_${iata}`, 7 * 86_400_000, () => this.querySights(lat, lon)
        .catch((e) => (environment.useMocks ? Promise.reject(e) : firstValueFrom(this.http.get<Sight[]>(`${environment.apiUrl}/destinations/${encodeURIComponent(iata)}/sights`)))))
        .catch((e) => {
        this.sightsCache.delete(iata);
        throw e;
      });
      this.sightsCache.set(iata, p);
    }
    return this.sightsCache.get(iata)!;
  }

  holidays(country: string, year: number): Promise<Holiday[]> {
    const key = `${country}|${year}`;
    if (!this.holidayCache.has(key)) {
      const p = deviceCached(`hol_${country}_${year}`, 30 * 86_400_000, () => (publicFetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${encodeURIComponent(country)}`, { timeoutMs: 10_000 }).then((r) => {
            if (r.status === 204 || r.status === 404) return [];
            if (r.status !== 200) throw new Error('holidays');
            return (JSON.parse(r.text) as { date: string; localName: string; name: string; global: boolean }[]).map((h) => ({
              date: h.date, localName: h.localName, name: h.name, national: h.global,
            }));
          }) as Promise<Holiday[]>)
        .catch((e) => (environment.useMocks ? Promise.reject(e) : firstValueFrom(this.http.get<Holiday[]>(`${environment.apiUrl}/countries/${encodeURIComponent(country)}/holidays`, { params: { year } })))))
        .catch((e) => {
        this.holidayCache.delete(key);
        throw e;
      });
      this.holidayCache.set(key, p);
    }
    return this.holidayCache.get(key)!;
  }

  private async querySights(lat: number, lon: number): Promise<Sight[]> {
    const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sightsQuery(lat, lon));
    const r = await publicFetch(url, { timeoutMs: 15_000 });
    if (r.status !== 200) throw new Error('sights');
    return parseSights(JSON.parse(r.text) as SparqlResult);
  }
}

export interface SparqlResult {
  results: { bindings: Record<string, { value: string } | undefined>[] };
}

export function sightsQuery(lat: number, lon: number, radiusKm = 8): string {
  return `SELECT ?item ?itemLabel ?desc ?img ?loc ?dist ?links ?article WHERE {
  SERVICE wikibase:around { ?item wdt:P625 ?loc . bd:serviceParam wikibase:center "Point(${lon.toFixed(5)} ${lat.toFixed(5)})"^^geo:wktLiteral ; wikibase:radius "${radiusKm}" ; wikibase:distance ?dist . }
  VALUES ?type { wd:Q570116 wd:Q33506 wd:Q16970 wd:Q839954 wd:Q4989906 wd:Q23413 wd:Q12280 wd:Q22698 wd:Q2977 wd:Q44539 wd:Q174782 wd:Q1107656 wd:Q16560 wd:Q32815 wd:Q207694 wd:Q1076486 wd:Q40080 wd:Q11303 wd:Q483453 wd:Q57821 }
  ?item wdt:P31/wdt:P279? ?type .
  ?item wikibase:sitelinks ?links .
  FILTER(?links >= 8)
  OPTIONAL { ?item wdt:P18 ?img . }
  OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul" . }
} ORDER BY DESC(?links) LIMIT 60`;
}

export function parseSights(res: SparqlResult): Sight[] {
  const seen = new Set<string>();
  const out: Sight[] = [];
  for (const b of res.results.bindings) {
    const id = b['item']?.value.split('/').pop();
    const name = b['itemLabel']?.value;
    const m = b['loc']?.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
    if (!id || !name || !m || seen.has(id) || /^Q\d+$/.test(name)) continue;
    seen.add(id);
    const img = b['img']?.value;
    out.push({
      id,
      name,
      description: b['desc']?.value,
      image: img ? img.replace(/^http:/, 'https:') + '?width=480' : undefined,
      lon: +m[1],
      lat: +m[2],
      distanceKm: Math.round(+(b['dist']?.value ?? 0) * 10) / 10,
      wikipedia: b['article']?.value,
    });
    if (out.length >= 24) break;
  }
  return out;
}
