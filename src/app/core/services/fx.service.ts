import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Currencies with a daily ECB reference rate. */
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
      const p = (environment.useMocks
        ? fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`).then(async (r) => {
            if (!r.ok) throw new Error('fx');
            const j = await r.json();
            return { base: from, currency: to, rate: j.rates[to] as number, date: j.date as string };
          })
        : firstValueFrom(this.http.get<FxRate>(`${environment.apiUrl}/fx`, { params: { from, to } }))
      ).catch((e) => {
        this.cache.delete(key);
        throw e;
      });
      this.cache.set(key, p);
    }
    return this.cache.get(key)!;
  }
}
