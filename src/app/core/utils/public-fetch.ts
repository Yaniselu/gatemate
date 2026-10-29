import { Capacitor, CapacitorHttp } from '@capacitor/core';

export interface PublicResponse {
  status: number;
  text: string;
}

/**
 * Requests to public open-data services (OpenStreetMap, ADS-B). In the app they go through the native HTTP stack,
 * so they don't depend on the service's CORS headers or on the web view; in a browser they use fetch.
 * Never used for our own API (that goes through HttpClient with the auth interceptor).
 */
export async function publicFetch(
  url: string,
  opts: { method?: 'GET' | 'POST'; form?: Record<string, string>; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<PublicResponse> {
  const method = opts.method ?? 'GET';
  const timeout = opts.timeoutMs ?? 20_000;
  const body = opts.form ? new URLSearchParams(opts.form).toString() : undefined;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded';

  if (Capacitor.isNativePlatform()) {
    const r = await withAbort(
      CapacitorHttp.request({ url, method, headers, data: body, responseType: 'text', connectTimeout: timeout, readTimeout: timeout }),
      opts.signal,
    );
    return { status: r.status, text: typeof r.data === 'string' ? r.data : JSON.stringify(r.data) };
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  opts.signal?.addEventListener('abort', () => ctl.abort());
  try {
    const r = await fetch(url, { method, headers, body, signal: ctl.signal });
    return { status: r.status, text: await r.text() };
  } finally {
    clearTimeout(timer);
  }
}

function withAbort<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p;
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    p.then(resolve, reject);
  });
}

/** GET (or POST) JSON from a public source; throws on HTTP errors and after the timeout. */
export async function publicJson<T>(url: string, opts: { timeoutMs?: number; accept?: string } = {}): Promise<T> {
  const r = await publicFetch(url, { timeoutMs: opts.timeoutMs ?? 12_000 });
  if (r.status < 200 || r.status >= 300) throw new Error(`HTTP ${r.status}`);
  return JSON.parse(r.text) as T;
}

/**
 * Keeps public data (city guide, sights, holidays, rates) on the device: fresh copies are used straight away,
 * older ones refresh in the background, and anything up to a month old still shows when offline.
 */
export async function deviceCached<T>(key: string, freshMs: number, load: () => Promise<T>): Promise<T> {
  const { Preferences } = await import('@capacitor/preferences');
  const k = 'gm_pub_' + key;
  let saved: { at: number; data: T } | null = null;
  try {
    const { value } = await Preferences.get({ key: k });
    saved = value ? JSON.parse(value) : null;
  } catch {
    saved = null;
  }
  const store = (data: T) => Preferences.set({ key: k, value: JSON.stringify({ at: Date.now(), data }) }).catch(() => {});
  if (saved && Date.now() - saved.at < freshMs) return saved.data;
  if (saved && Date.now() - saved.at < 30 * 86_400_000) {
    void load().then(store, () => {});
    return saved.data;
  }
  const data = await load();
  void store(data);
  return data;
}
