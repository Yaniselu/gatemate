import { inject, Injectable } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../environments/environment';
import { GatemateApi } from './api';
import { AlertKind, FlightAlert, NotificationPrefs } from '../models';
import { PlatformService } from './platform.service';
import { PrefsService } from './prefs.service';

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
    if (granted) {
      void this.registerPush();
      void this.refresh();
    }
    return granted;
  }

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

  private last: FlightAlert[] = [];
  private queue: Promise<void> = Promise.resolve();

  syncReminders(alerts: FlightAlert[]): Promise<void> {
    this.last = alerts;
    this.queue = this.queue.then(() => this.apply(alerts)).catch(() => {});
    return this.queue;
  }

  refresh(): Promise<void> {
    return this.syncReminders(this.last);
  }

  async exactAlarmsAllowed(): Promise<boolean> {
    if (!this.platform.isNative || this.platform.platform !== 'android') return true;
    try {
      return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted';
    } catch {
      return true;
    }
  }

  async allowExactAlarms(): Promise<boolean> {
    try {
      return (await LocalNotifications.changeExactNotificationSetting()).exact_alarm === 'granted';
    } catch {
      return false;
    }
  }

  private async apply(alerts: FlightAlert[]): Promise<void> {
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
    const seen = new Set<number>();
    const due = alerts
      .filter((a) => a.source === 'device' && a.scheduledFor && +new Date(a.scheduledFor) > Date.now() + 5_000 && prefs[pref[a.kind]])
      .sort((a, b) => +new Date(a.scheduledFor!) - +new Date(b.scheduledFor!))
      .filter((a) => {
        const id = hash(a.id);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .slice(0, 48);
    if (!due.length) return;
    await LocalNotifications.schedule({
      notifications: due.map((a) => ({
        id: hash(a.id),
        title: a.title,
        body: a.body,
        schedule: { at: new Date(a.scheduledFor!), allowWhileIdle: true },
        extra: { gm: true, flightId: a.flightId, tripId: a.tripId },
      })),
    });
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 2_000_000_000 + 1;
}
