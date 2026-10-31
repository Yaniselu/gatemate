import { inject, Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PlatformService } from './platform.service';
import { AuthService } from './auth.service';
import { randomId } from '../security/crypto.util';
import { t as tr } from '../i18n/i18n.service';

export type LostKind = 'delayed' | 'damaged' | 'plane' | 'airport';

export interface LostCase {
  id: string;
  kind: LostKind;
  createdAt: string;
  flightId?: string;
  flight?: string;
  airline?: string;
  airport?: string;
  date?: string;
  reference?: string;
  item: string;
  details?: string;
  receivedAt?: string;
  expenses?: number;
  currency?: string;
  resolved?: boolean;
}

const DAY = 86_400_000;

export function deadline(c: LostCase): { at: Date; label: string; lost?: boolean } | null {
  const start = new Date(c.date || c.createdAt).getTime();
  if (c.kind === 'damaged') {
    const from = c.receivedAt ? new Date(c.receivedAt).getTime() : start;
    return { at: new Date(from + 7 * DAY), label: 'Written complaint due' };
  }
  if (c.kind === 'delayed') {
    if (c.receivedAt) return { at: new Date(new Date(c.receivedAt).getTime() + 21 * DAY), label: 'Claim for delay costs due' };
    return { at: new Date(start + 21 * DAY), label: 'Counts as lost after', lost: true };
  }
  return null;
}

@Injectable({ providedIn: 'root' })
export class LostFoundService {
  private platform = inject(PlatformService);
  private auth = inject(AuthService);
  readonly cases = signal<LostCase[]>([]);
  private loaded = false;

  private key() {
    return `gm_lost_${this.auth.user()?.id ?? 'guest'}`;
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const { value } = await Preferences.get({ key: this.key() });
      this.cases.set(value ? (JSON.parse(value) as LostCase[]) : []);
    } catch {
      this.cases.set([]);
    }
    this.loaded = true;
  }

  async save(c: Omit<LostCase, 'id' | 'createdAt'> & { id?: string }): Promise<LostCase> {
    await this.load();
    const existing = c.id ? this.cases().find((x) => x.id === c.id) : undefined;
    const out: LostCase = { ...(existing ?? { id: randomId('lf_'), createdAt: new Date().toISOString() }), ...c } as LostCase;
    this.cases.update((list) => [out, ...list.filter((x) => x.id !== out.id)]);
    await this.persist();
    await this.remind(out);
    return out;
  }

  async remove(id: string): Promise<void> {
    this.cases.update((list) => list.filter((x) => x.id !== id));
    await this.persist();
    await this.cancel(id);
  }

  private async persist() {
    try {
      await Preferences.set({ key: this.key(), value: JSON.stringify(this.cases()) });
    } catch {
      return;
    }
  }

  private notificationId(id: string) {
    let h = 7;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return 900_000 + (Math.abs(h) % 90_000);
  }

  private async cancel(id: string) {
    if (!this.platform.isNative) return;
    await LocalNotifications.cancel({ notifications: [{ id: this.notificationId(id) }] }).catch(() => {});
  }

  private async remind(c: LostCase) {
    await this.cancel(c.id);
    const d = deadline(c);
    if (!d || c.resolved || !this.platform.isNative) return;
    const at = d.at.getTime() - 2 * DAY;
    if (at < Date.now()) return;
    const perm = await LocalNotifications.checkPermissions().catch(() => null);
    if (perm?.display !== 'granted') return;
    await LocalNotifications.schedule({
      notifications: [{
        id: this.notificationId(c.id),
        title: tr('2 days left: {item}', { item: c.item }),
        body: d.lost ? tr('If your bag still isn’t back, claim it as lost with the airline.') : tr('Send your written claim to the airline before the deadline.'),
        schedule: { at: new Date(at), allowWhileIdle: true },
        extra: { route: '/lost-found' },
      }],
    }).catch(() => {});
  }
}
