import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

@Injectable({ providedIn: 'root' })
export class PlatformService {
  readonly isNative = Capacitor.isNativePlatform();
  readonly platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';
  readonly reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  tap(): void {
    if (this.isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  }

  impact(): void {
    if (this.isNative) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
  }

  success(): void {
    if (this.isNative) Haptics.notification({ type: NotificationType.Success }).catch(() => {});
  }

  error(): void {
    if (this.isNative) Haptics.notification({ type: NotificationType.Error }).catch(() => {});
  }

  selection(): void {
    if (this.isNative) Haptics.selectionChanged().catch(() => {});
  }
}
