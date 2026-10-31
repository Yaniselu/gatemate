import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { deviceCached, publicJson } from '../utils/public-fetch';

export const FX_CURRENCIES = ['EUR', 'USD', 'GBP', 'RON', 'CHF', 'PLN', 'CZK', 'HUF', 'BGN', 'DKK', 'SEK', 'NOK', 'ISK', 'TRY', 'JPY', 'CNY', 'KRW', 'HKD', 'SGD', 'THB', 'MYR', 'IDR', 'PHP', 'INR', 'ILS', 'AUD', 'NZD', 'CAD', 'MXN', 'BRL', 'ZAR'];

export interface FxRate { base: string; currency: string; rate: number; date: string }

@Injectable({ providedIn: 'root' })
export class FxService {
  private http = inject(HttpClient);
  private cache = new Map<string, Promise<FxRate>>();

  rate(from: string, to: string): Promise<FxRate> {
    if (from === to) return Promise.resolve({ base: from, currency: to, rate: 1, date: new Date().toISOString().slice(0, 10) });
    const key = `${from}|${to}`;
    if (!this.cache.has(key)) {
      const p = deviceCached(`fx_${from}_${to}`, 6 * 3600_000, () => publicJson<{ rates: Record<string, number>; date: string }>(`https://api.frankfurter.app/latest?from=${from}&to=${to}`, { timeoutMs: 8000 })
        .then((j) => ({ base: from, currency: to, rate: j.rates[to], date: j.date }))
        .catch((e) => (environment.useMocks ? Promise.reject(e) : firstValueFrom(this.http.get<FxRate>(`${environment.apiUrl}/fx`, { params: { from, to } })))))
        .catch((e) => {
        this.cache.delete(key);
        throw e;
      });
      this.cache.set(key, p);
    }
    return this.cache.get(key)!;
  }
}
