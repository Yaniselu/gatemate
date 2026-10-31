import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';

@Injectable({ providedIn: 'root' })
export class SecureStorageService {
  private readonly native = Capacitor.isNativePlatform();
  private readonly memory = new Map<string, string>();
  private readonly webSession = !this.native;
  private ready: Promise<void> | null = null;

  private init(): Promise<void> {
    this.ready ??= this.native ? SecureStorage.setKeyPrefix('gatemate_').then(() => SecureStorage.setSynchronize(false)) : Promise.resolve();
    return this.ready;
  }

  async get(key: string): Promise<string | null> {
    if (this.webSession) return this.session('get', key);
    if (!this.native) return this.memory.get(key) ?? null;
    await this.init();
    try {
      const v = await SecureStorage.get(key);
      return typeof v === 'string' ? v : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    if (this.webSession) {
      this.session('set', key, value);
      return;
    }
    if (!this.native) {
      this.memory.set(key, value);
      return;
    }
    await this.init();
    await SecureStorage.set(key, value, false, false, KeychainAccess.whenUnlockedThisDeviceOnly);
  }

  async remove(key: string): Promise<void> {
    this.memory.delete(key);
    if (this.webSession) this.session('remove', key);
    if (!this.native) return;
    await this.init();
    await SecureStorage.remove(key).catch(() => false);
  }

  async clear(): Promise<void> {
    this.memory.clear();
    if (this.webSession) this.session('clear');
    if (!this.native) return;
    await this.init();
    await SecureStorage.clear().catch(() => {});
  }

  private session(op: 'get' | 'set' | 'remove' | 'clear', key = '', value = ''): string | null {
    try {
      const k = 'gm_s_' + key;
      if (op === 'get') return sessionStorage.getItem(k);
      if (op === 'set') sessionStorage.setItem(k, value);
      if (op === 'remove') sessionStorage.removeItem(k);
      if (op === 'clear') Object.keys(sessionStorage).filter((x) => x.startsWith('gm_s_')).forEach((x) => sessionStorage.removeItem(x));
    } catch {
      if (op === 'get') return this.memory.get(key) ?? null;
      if (op === 'set') this.memory.set(key, value);
    }
    return null;
  }
}
