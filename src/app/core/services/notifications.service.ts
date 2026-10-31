import { inject, Injectable } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../environments/environment';
import { GatemateApi } from './api';
import { AlertKind, Flight, FlightAlert, NotificationPrefs } from '../models';
import { PlatformService } from './platform.service';
import { PrefsService } from './prefs.service';
import { t as tr } from '../i18n/i18n.service';

/**
 * Local reminders derived from the user's flights. Live gate/delay alerts arrive as push
 * notifications from the backend once it exists (APNs / FCM).
 */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private platform = inject(PlatformService);
  private prefs = inject(PrefsService);
  private api = inject(GatemateApi);
  private pushRegistered = false;

  async requestPermission(): Promise<boolean> {
    if (!this.platform.isNative) return false;
    const res = await LocalNotifications.requestPermissions().catch(() => null);
    const granted = res?.display === 'granted';
    if (granted) void this.registerPush();
    return granted;
  }

  /** Gate changes and delays come from the server as push notifications; the device token is sent only to our API. */
  private async registerPush(): Promise<void> {
    if (!environment.push || this.pushRegistered) return;
    this.pushRegistered = true;
    try {
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== 'granted') return;
      await PushNotifications.addListener('registration', ({ value }) => {
        void this.api.registerPushToken(value, Capacitor.getPlatform() === 'ios' ? 'ios' : 'android').catch(() => {});
      });
      await PushNotifications.register();
    } catch {
      this.pushRegistered = false;
    }
  }

  /** Schedules device reminders (check-in, leave for the airport, boarding…) as local notifications. */
  async syncReminders(alerts: FlightAlert[]): Promise<void> {
    if (!this.platform.isNative) return;
    const perm = await LocalNotifications.checkPermissions().catch(() => null);
    if (perm?.display !== 'granted') return;
    const prefs = this.prefs.notifications();
    const pref: Record<AlertKind, keyof NotificationPrefs> = {
      boarding: 'boarding', leave: 'boarding', gate: 'gateChanges', delay: 'delays', weather: 'delays', checkin: 'checkIn',
      documents: 'checkIn', bags: 'checkIn', checklist: 'checkIn', baggage: 'baggage', chat: 'chat', info: 'tips',
    };
    const pending = await LocalNotifications.getPending().catch(() => ({ notifications: [] }));
    const ours = pending.notifications.filter((n) => n.extra?.gm === true);
    if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) }).catch(() => {});
    const due = alerts
      .filter((a) => a.source === 'device' && a.scheduledFor && +new Date(a.scheduledFor) > Date.now() && prefs[pref[a.kind]])
      .slice(0, 60);
    if (!due.length) return;
    await LocalNotifications.schedule({
      notifications: due.map((a) => ({ id: hash(a.id) + 7, title: a.title, body: a.body, schedule: { at: new Date(a.scheduledFor!), allowWhileIdle: true }, extra: { gm: true, flightId: a.flightId } })),
    });
  }

  async scheduleForFlight(flight: Flight): Promise<void> {
    if (!this.platform.isNative) return;
    const prefs = this.prefs.notifications();
    const perm = await LocalNotifications.checkPermissions().catch(() => null);
    if (perm?.display !== 'granted') return;

    const boarding = new Date(flight.boardingTime).getTime();
    const departure = new Date(flight.departure).getTime();
    const baseId = hash(flight.id);
    const gate = flight.gate ?? tr('TBA');
    const items = [
      prefs.checkIn && { id: baseId + 1, at: departure - 24 * 3600_000, title: tr('Check-in is open · {flight}', { flight: flight.number }), body: tr('Check in for {from} → {to}.', { from: flight.from.city, to: flight.to.city }) },
      ...[20, 10, 5].map((min, i) => prefs.boarding && { id: baseId + 2 + i, at: boarding - min * 60_000, title: tr('Boarding in {min} minutes · {flight}', { min, flight: flight.number }), body: tr('{flight} · Gate {gate} · Seat {seat}', { flight: flight.number, gate, seat: flight.seat ?? '—' }) }),
      prefs.boarding && { id: baseId + 5, at: boarding, title: tr('Boarding has started ✈️'), body: tr('Head to gate {gate} now.', { gate }) },
    ].filter((x): x is { id: number; at: number; title: string; body: string } => !!x && x.at > Date.now());

    await LocalNotifications.cancel({ notifications: [1, 2, 3, 4, 5].map((n) => ({ id: baseId + n })) }).catch(() => {});
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
