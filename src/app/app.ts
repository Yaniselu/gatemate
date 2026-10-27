import { ChangeDetectionStrategy, Component, effect, inject, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { PrefsService } from './core/services/prefs.service';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AppLockService } from './core/security/app-lock.service';
import { LockScreenComponent } from './shared/components/lock-screen.component';
import { BadgeToastComponent } from './shared/components/badge-toast.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonApp, IonRouterOutlet, LockScreenComponent, BadgeToastComponent],
  template: `
    <ion-app>
      <div class="gm-ambient" aria-hidden="true"><i class="a1"></i><i class="a2"></i><i class="a3"></i><i class="a4"></i></div>
      <ion-router-outlet />
      <gm-badge-toast />
      @if (lock.locked()) {
        <gm-lock-screen />
      }
    </ion-app>
  `,
})
export class App {
  protected lock = inject(AppLockService);
  private prefs = inject(PrefsService);

  constructor() {
    effect(() => {
      const root = document.documentElement;
      root.style.setProperty('--gm-text-zoom', String(this.prefs.textScale()));
      root.classList.toggle('gm-reduce-motion', this.prefs.reduceMotion());
      root.classList.toggle('gm-high-contrast', this.prefs.highContrast());
    });
    // Universal / App Links: only our own invite paths are routed; anything else is ignored.
    if (Capacitor.isNativePlatform()) {
      const router = inject(Router);
      const zone = inject(NgZone);
      void CapApp.addListener('appUrlOpen', ({ url }) => {
        try {
          const u = new URL(url);
          const m = u.pathname.match(/^\/invite\/([A-Za-z0-9_-]{16,64})$/);
          if (u.hostname === 'gatemate.app' && m) zone.run(() => void router.navigateByUrl(`/invite/${m[1]}`));
        } catch {
          /* malformed link */
        }
      });
    }
  }
}
