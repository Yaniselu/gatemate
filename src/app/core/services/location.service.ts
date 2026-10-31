import { inject, Injectable, NgZone, signal } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { PlatformService } from './platform.service';

export interface Fix {
  lat: number;
  lon: number;
  accuracy: number;
  at: number;
}

@Injectable({ providedIn: 'root' })
export class LocationService {
  private platform = inject(PlatformService);
  private zone = inject(NgZone);
  readonly fix = signal<Fix | null>(null);
  readonly denied = signal(false);
  private watchId: string | null = null;

  async locate(): Promise<Fix | null> {
    try {
      if (this.platform.isNative) {
        const perm = await Geolocation.requestPermissions({ permissions: ['location'] });
        if (perm.location !== 'granted') throw new Error('denied');
      }
      const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 });
      const f = { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy, at: p.timestamp };
      this.fix.set(f);
      this.denied.set(false);
      return f;
    } catch {
      this.denied.set(true);
      return null;
    }
  }

  async watch(): Promise<void> {
    if (this.watchId || this.denied()) return;
    try {
      this.watchId = await Geolocation.watchPosition({ enableHighAccuracy: true, maximumAge: 10_000 }, (p) =>
        this.zone.run(() => p && this.fix.set({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy, at: p.timestamp })),
      );
    } catch {
      this.watchId = null;
    }
  }

  async stop(): Promise<void> {
    if (this.watchId) await Geolocation.clearWatch({ id: this.watchId }).catch(() => {});
    this.watchId = null;
  }
}

export function walkMinutes(meters: number): number {
  return Math.max(1, Math.round((meters * 1.3) / 80));
}

export function directionsUrl(lat: number, lon: number, label: string, ios: boolean): string {
  return ios
    ? `https://maps.apple.com/?daddr=${lat},${lon}&q=${encodeURIComponent(label)}`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}
