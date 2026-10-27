import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AppLockService } from './core/security/app-lock.service';
import { LockScreenComponent } from './shared/components/lock-screen.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonApp, IonRouterOutlet, LockScreenComponent],
  template: `
    <ion-app>
      <div class="gm-ambient"></div>
      <ion-router-outlet />
      @if (lock.locked()) {
        <gm-lock-screen />
      }
    </ion-app>
  `,
})
export class App {
  protected lock = inject(AppLockService);
}
