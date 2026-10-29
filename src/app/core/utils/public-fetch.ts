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
