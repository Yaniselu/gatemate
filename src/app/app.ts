import { StatusBar, Style } from '@capacitor/status-bar';
import { LiveActivityService } from './core/services/live-activity.service';
import { NotificationsService } from './core/services/notifications.service';
import { KeyboardService } from './core/services/keyboard.service';
import { PerformanceService } from './core/services/performance.service';
import { TravelStore } from './core/services/travel.store';
import { ChangeDetectionStrategy, Component, effect, inject, NgZone, signal } from '@angular/core';
import { Router } from '@angular/router';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { environment } from '../environments/environment';
import { PrefsService } from './core/services/prefs.service';
import { IonApp, IonIcon, IonRouterOutlet } from '@ionic/angular/standalone';
import { NetworkService } from './core/services/network.service';
import { AppLockService } from './core/security/app-lock.service';
import { LockScreenComponent } from './shared/components/lock-screen.component';
import { BadgeToastComponent } from './shared/components/badge-toast.component';
import { TranslatePipe } from './core/i18n/i18n.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonApp, IonIcon, IonRouterOutlet, LockScreenComponent, BadgeToastComponent],
  template: `
    <ion-app>
      <div class="gm-ambient" aria-hidden="true"><i class="a1"></i><i class="a2"></i><i class="a3"></i><i class="a4"></i></div>
      <ion-router-outlet />
      @if (!net.online()) {
        <div class="gm-offline" role="status"><ion-icon name="cloud-offline-outline" /> {{ 'Offline · your trips and passes are saved on this phone' | t }}</div>
      }
      <gm-badge-toast />
      @if (lock.locked()) {
        <gm-lock-screen />
      }
    </ion-app>
  `,
})
export class App {
  protected lock = inject(AppLockService);
  protected net = inject(NetworkService);
  private prefs = inject(PrefsService);
  private liveActivity = inject(LiveActivityService);
  private store = inject(TravelStore);
  private notifications = inject(NotificationsService);

  constructor() {
    inject(PerformanceService).start();
    inject(KeyboardService).start();
    document.addEventListener('touchstart', () => {}, { passive: true });
    let scheduled = '';
    effect(() => {
      const due = this.store.upcomingReminders().filter((a) => a.source === 'device');
      const key = due.map((a) => a.id + '@' + a.scheduledFor).join('|');
      if (key === scheduled) return;
      scheduled = key;
      void this.notifications.syncReminders(due);
    });
    effect(() => {
      const root = document.documentElement;
      root.style.setProperty('--gm-text-zoom', String(this.prefs.textScale()));
      root.classList.toggle('gm-reduce-motion', this.prefs.reduceMotion());
      root.classList.toggle('gm-high-contrast', this.prefs.highContrast());
    });
    const media = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
    const systemDark = signal(media?.matches ?? false);
    media?.addEventListener('change', (e) => systemDark.set(e.matches));
    effect(() => {
      const theme = this.prefs.theme();
      const dark = theme === 'dark' || (theme === 'system' && systemDark());
      const root = document.documentElement;
      root.classList.toggle('gm-dark', dark);
      root.classList.toggle('ion-palette-dark', dark);
      if (Capacitor.isNativePlatform()) void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
    });
    if (!environment.useMocks) {
      try {
        void fetch(new URL(environment.apiUrl).origin + '/actuator/health', { cache: 'no-store' }).catch(() => {});
      } catch {
      }
    }
    if (Capacitor.isNativePlatform()) {
      const router = inject(Router);
      const zone = inject(NgZone);
      void CapApp.addListener('appUrlOpen', ({ url }) => {
        try {
          const u = new URL(url);
          const m = u.pathname.match(/^\/invite\/([A-Za-z0-9_-]{16,64})$/);
          if (u.hostname === 'gatemate.app' && m) zone.run(() => void router.navigateByUrl(`/invite/${m[1]}`));
        } catch {
        }
      });
    }
  }
}
