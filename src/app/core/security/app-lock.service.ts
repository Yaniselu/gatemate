import { inject, Injectable, NgZone, signal } from '@angular/core';
import { App } from '@capacitor/app';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { PrivacyScreen } from '@capacitor/privacy-screen';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { PlatformService } from '../services/platform.service';
import { PrefsService } from '../services/prefs.service';

const RELOCK_AFTER_BACKGROUND_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class AppLockService {
  private auth = inject(AuthService);
  private prefs = inject(PrefsService);
  private platform = inject(PlatformService);
  private zone = inject(NgZone);

  readonly locked = signal(false);
  readonly biometryLabel = signal('Face ID');
  private backgroundedAt = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  async init(): Promise<void> {
    if (!this.platform.isNative) return;
    await PrivacyScreen.enable({ android: { preventScreenshots: false, privacyModeOnActivityHidden: 'splash' }, ios: { blurEffect: 'light' } }).catch(() => {});
    await this.detectBiometry();

    App.addListener('appStateChange', ({ isActive }) =>
      this.zone.run(() => {
        if (!isActive) {
          this.backgroundedAt = Date.now();
        } else if (this.backgroundedAt && Date.now() - this.backgroundedAt > RELOCK_AFTER_BACKGROUND_MS) {
          this.lockIfEnabled();
        }
      }),
    );

    const bump = () => this.resetIdle();
    ['pointerdown', 'keydown'].forEach((e) => document.addEventListener(e, bump, { passive: true }));
    this.resetIdle();
  }

  async isAvailable(): Promise<boolean> {
    if (!this.platform.isNative) return false;
    const info = await BiometricAuth.checkBiometry().catch(() => null);
    return !!info?.isAvailable || !!info?.deviceIsSecure;
  }

  lockIfEnabled(): void {
    if (this.prefs.biometricLock() && this.auth.status() === 'signed-in') this.locked.set(true);
  }

  async unlock(): Promise<boolean> {
    try {
      await BiometricAuth.authenticate({
        reason: 'Unlock Gatemate',
        cancelTitle: 'Cancel',
        allowDeviceCredential: true,
        iosFallbackTitle: 'Use passcode',
        androidTitle: 'Unlock Gatemate',
      });
      this.locked.set(false);
      this.platform.success();
      this.resetIdle();
      return true;
    } catch {
      return false;
    }
  }

  async confirmPresence(reason: string): Promise<boolean> {
    if (!this.platform.isNative) return true;
    try {
      await BiometricAuth.authenticate({ reason, cancelTitle: 'Cancel', allowDeviceCredential: true, androidTitle: reason });
      return true;
    } catch {
      return false;
    }
  }

  private resetIdle(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.zone.run(() => this.lockIfEnabled()), environment.security.idleLockMinutes * 60_000);
  }

  private async detectBiometry(): Promise<void> {
    const info = await BiometricAuth.checkBiometry().catch(() => null);
    const t = info?.biometryType;
    this.biometryLabel.set(t === 1 ? 'Touch ID' : t === 2 ? 'Face ID' : t === 3 ? 'Fingerprint' : 'Biometrics');
  }
}
