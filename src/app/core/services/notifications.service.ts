import { inject, Injectable } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Flight } from '../models';
import { PlatformService } from './platform.service';
import { PrefsService } from './prefs.service';

/**
 * Local reminders derived from the user's flights. Live gate/delay alerts arrive as push
 * notifications from the backend once it exists (APNs / FCM).
 */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private platform = inject(PlatformService);
  private prefs = inject(PrefsService);

  async requestPermission(): Promise<boolean> {
    if (!this.platform.isNative) return false;
    const res = await LocalNotifications.requestPermissions().catch(() => null);
    return res?.display === 'granted';
  }

  async scheduleForFlight(flight: Flight): Promise<void> {
    if (!this.platform.isNative) return;
    const prefs = this.prefs.notifications();
    const perm = await LocalNotifications.checkPermissions().catch(() => null);
    if (perm?.display !== 'granted') return;

    const boarding = new Date(flight.boardingTime).getTime();
    const departure = new Date(flight.departure).getTime();
    const baseId = hash(flight.id);
    const items = [
      prefs.checkIn && { id: baseId + 1, at: departure - 24 * 3600_000, title: `Check-in is open · ${flight.number}`, body: `Check in for ${flight.from.city} → ${flight.to.city}.` },
      prefs.boarding && { id: baseId + 2, at: boarding - 15 * 60_000, title: 'Boarding in 15 minutes', body: `${flight.number} · Gate ${flight.gate ?? 'TBA'} · Seat ${flight.seat ?? '—'}` },
      prefs.boarding && { id: baseId + 3, at: boarding, title: 'Boarding has started ✈️', body: `Head to gate ${flight.gate ?? 'TBA'} now.` },
    ].filter((x): x is { id: number; at: number; title: string; body: string } => !!x && x.at > Date.now());

    await LocalNotifications.cancel({ notifications: [1, 2, 3].map((n) => ({ id: baseId + n })) }).catch(() => {});
    if (!items.length) return;
    await LocalNotifications.schedule({
      notifications: items.map((n) => ({ id: n.id, title: n.title, body: n.body, schedule: { at: new Date(n.at), allowWhileIdle: true } })),
    });
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (Math.abs(h) % 100_000) * 10;
}
