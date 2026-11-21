import { Capacitor } from '@capacitor/core';

export function openExternal(url: string): void {
  if (!/^(https:|mailto:|tel:|maps:)/i.test(url)) return;
  if (Capacitor.isNativePlatform()) {
    window.location.assign(url);
    return;
  }
  window.open(url, '_blank', 'noopener');
}
