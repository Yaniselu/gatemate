import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';
import { environment } from '../../../environments/environment';

/**
 * Secrets (refresh tokens) live in the iOS Keychain / Android Keystore-backed storage.
 * On the web build nothing sensitive is persisted: values stay in memory for the tab only,
 * so an XSS or a shared computer cannot lift a long-lived token from localStorage.
 * Exception: the mock-data web preview keeps its fake session in sessionStorage so a page
 * reload does not sign you out. Builds talking to the real API never do this.
 */
@Injectable({ providedIn: 'root' })
export class SecureStorageService {
  private readonly native = Capacitor.isNativePlatform();
  private readonly memory = new Map<string, string>();
  private readonly mockWebSession = !this.native && environment.useMocks;
  private ready: Promise<void> | null = null;

  private init(): Promise<void> {
    this.ready ??= this.native ? SecureStorage.setKeyPrefix('gatemate_').then(() => SecureStorage.setSynchronize(false)) : Promise.resolve();
    return this.ready;
  }

  async get(key: string): Promise<string | null> {
    if (this.mockWebSession) return this.session('get', key);
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
    if (this.mockWebSession) {
      this.session('set', key, value);
      return;
    }
    if (!this.native) {
      this.memory.set(key, value);
      return;
    }
    await this.init();
    // Device-only, unavailable while locked: never synced to iCloud or restored on another phone.
    await SecureStorage.set(key, value, false, false, KeychainAccess.whenUnlockedThisDeviceOnly);
  }

  async remove(key: string): Promise<void> {
    this.memory.delete(key);
    if (this.mockWebSession) this.session('remove', key);
    if (!this.native) return;
    await this.init();
    await SecureStorage.remove(key).catch(() => false);
  }

  async clear(): Promise<void> {
    this.memory.clear();
    if (this.mockWebSession) this.session('clear');
    if (!this.native) return;
    await this.init();
    await SecureStorage.clear().catch(() => {});
  }

  private session(op: 'get' | 'set' | 'remove' | 'clear', key = '', value = ''): string | null {
    try {
      const k = 'gm_mock_' + key;
      if (op === 'get') return sessionStorage.getItem(k);
      if (op === 'set') sessionStorage.setItem(k, value);
      if (op === 'remove') sessionStorage.removeItem(k);
      if (op === 'clear') Object.keys(sessionStorage).filter((x) => x.startsWith('gm_mock_')).forEach((x) => sessionStorage.removeItem(x));
    } catch {
      /* storage blocked: fall back to in-memory only */
      if (op === 'get') return this.memory.get(key) ?? null;
      if (op === 'set') this.memory.set(key, value);
    }
    return null;
  }
}
