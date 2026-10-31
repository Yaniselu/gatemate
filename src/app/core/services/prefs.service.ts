import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { NotificationPrefs } from '../models';

const DEFAULT_NOTIFS: NotificationPrefs = {
  boarding: true,
  gateChanges: true,
  delays: true,
  checkIn: true,
  baggage: true,
  chat: true,
  tips: false,
};

@Injectable({ providedIn: 'root' })
export class PrefsService {
  readonly onboarded = signal(false);
  readonly biometricLock = signal(false);
  readonly notifications = signal<NotificationPrefs>(DEFAULT_NOTIFS);
  readonly homeAirport = signal('OTP');
  readonly textScale = signal(1);
  readonly reduceMotion = signal(false);
  readonly highContrast = signal(false);
  readonly theme = signal<'system' | 'light' | 'dark'>('system');
  readonly themeChosen = signal(true);

  private loaded: Promise<void> | null = null;

  load(): Promise<void> {
    this.loaded ??= (async () => {
      this.onboarded.set((await this.read('onboarded')) === '1');
      this.biometricLock.set((await this.read('biometricLock')) === '1');
      this.homeAirport.set((await this.read('homeAirport')) || 'OTP');
      const scale = Number(await this.read('textScale'));
      if ([1, 1.15, 1.3].includes(scale)) this.textScale.set(scale);
      this.reduceMotion.set((await this.read('reduceMotion')) === '1');
      this.highContrast.set((await this.read('highContrast')) === '1');
      const theme = await this.read('theme');
      if (theme === 'light' || theme === 'dark' || theme === 'system') this.theme.set(theme);
      this.themeChosen.set(!!theme);
      try {
        const n = JSON.parse((await this.read('notifications')) || 'null');
        if (n && typeof n === 'object') this.notifications.set({ ...DEFAULT_NOTIFS, ...pickBooleans(n) });
      } catch {
      }
    })();
    return this.loaded;
  }

  async setTheme(theme: 'system' | 'light' | 'dark'): Promise<void> {
    this.theme.set(theme);
    this.themeChosen.set(true);
    await this.write('theme', theme);
  }

  async setOnboarded(): Promise<void> {
    this.onboarded.set(true);
    await this.write('onboarded', '1');
  }

  async setBiometricLock(on: boolean): Promise<void> {
    this.biometricLock.set(on);
    await this.write('biometricLock', on ? '1' : '0');
  }

  async setNotifications(prefs: NotificationPrefs): Promise<void> {
    this.notifications.set(prefs);
    await this.write('notifications', JSON.stringify(prefs));
  }

  async setHomeAirport(code: string): Promise<void> {
    this.homeAirport.set(code);
    await this.write('homeAirport', code);
  }

  async setAccessibility(p: { textScale?: number; reduceMotion?: boolean; highContrast?: boolean }): Promise<void> {
    if (p.textScale !== undefined) {
      this.textScale.set(p.textScale);
      await this.write('textScale', String(p.textScale));
    }
    if (p.reduceMotion !== undefined) {
      this.reduceMotion.set(p.reduceMotion);
      await this.write('reduceMotion', p.reduceMotion ? '1' : '0');
    }
    if (p.highContrast !== undefined) {
      this.highContrast.set(p.highContrast);
      await this.write('highContrast', p.highContrast ? '1' : '0');
    }
  }

  async reset(): Promise<void> {
    this.biometricLock.set(false);
    this.notifications.set(DEFAULT_NOTIFS);
    for (const k of ['biometricLock', 'notifications', 'homeAirport']) await Preferences.remove({ key: k }).catch(() => {});
  }

  private async read(key: string): Promise<string | null> {
    try {
      return (await Preferences.get({ key })).value;
    } catch {
      return null;
    }
  }

  private async write(key: string, value: string): Promise<void> {
    try {
      await Preferences.set({ key, value });
    } catch {
    }
  }
}

function pickBooleans(o: Record<string, unknown>): Partial<NotificationPrefs> {
  const out: Record<string, boolean> = {};
  for (const k of Object.keys(DEFAULT_NOTIFS)) if (typeof o[k] === 'boolean') out[k] = o[k] as boolean;
  return out as Partial<NotificationPrefs>;
}
