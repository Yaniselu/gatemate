import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToggle, IonToolbar } from '@ionic/angular/standalone';
import { PrefsService } from '../../core/services/prefs.service';
import { AppLockService } from '../../core/security/app-lock.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { PlatformService } from '../../core/services/platform.service';
import { RevealDirective } from '../../shared/directives/reveal.directive';

@Component({
  selector: 'gm-security-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, IonToggle, RevealDirective],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/profile" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>Security & privacy</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <div class="page">
        <div class="shield anim-scale-in"><ion-icon name="shield-checkmark" /><span class="pulse"></span></div>

        <div class="group glass flat">
          <div class="row">
            <span class="ic" style="--c:#0FB5C3"><ion-icon name="finger-print-outline" /></span>
            <div class="grow">
              <b>Lock with {{ lock.biometryLabel() }}</b>
              <small>{{ available() ? 'Ask for ' + lock.biometryLabel() + ' when opening Gatemate' : 'Available in the iOS and Android app' }}</small>
            </div>
            <ion-toggle [checked]="prefs.biometricLock()" [disabled]="!available()" (ionChange)="toggleLock($event.detail.checked)" aria-label="Biometric lock" />
          </div>
          @if (auth.user()?.provider === 'password') {
            <button class="row" (click)="changePassword()">
              <span class="ic" style="--c:#8B7CF6"><ion-icon name="key-outline" /></span>
              <div class="grow"><b>Change password</b><small>We will email you a secure link</small></div>
              <ion-icon name="chevron-forward" class="chev" />
            </button>
          }
          <button class="row" (click)="signOutEverywhere()">
            <span class="ic" style="--c:#FF5A5F"><ion-icon name="log-out-outline" /></span>
            <div class="grow"><b>Sign out on all devices</b><small>Revokes every active session</small></div>
            <ion-icon name="chevron-forward" class="chev" />
          </button>
        </div>

        <h3 class="sub">How we protect you</h3>
        @for (m of measures; track m.title; let i = $index) {
          <div class="measure" [gmReveal]="i">
            <ion-icon [name]="m.icon" />
            <div><b>{{ m.title }}</b><p>{{ m.body }}</p></div>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .page { padding: 8px 18px 40px; }
    .shield { position: relative; width: 84px; height: 84px; margin: 10px auto 22px; border-radius: 28px; display: flex; align-items: center; justify-content: center; font-size: 40px; color: #fff; background: linear-gradient(135deg,#2fd18a,#0fb5c3); box-shadow: 0 14px 30px rgba(47,209,138,.35); }
    .pulse { position: absolute; inset: 0; border-radius: inherit; border: 2px solid #2fd18a; animation: gm-ping 2s var(--gm-ease-out) infinite; }
    .group { border-radius: 22px; overflow: hidden; }
    .row { display: flex; align-items: center; gap: 12px; width: 100%; padding: 13px 14px; background: none; text-align: left; color: var(--gm-ink); border-bottom: 1px solid var(--gm-line); }
    .row:last-child { border-bottom: 0; }
    .ic { flex: none; width: 36px; height: 36px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #fff; background: var(--c); font-size: 18px; }
    .grow { flex: 1; min-width: 0; }
    .grow b { display: block; font-size: 15px; }
    .grow small { display: block; margin-top: 2px; line-height: 1.35; color: var(--gm-ink-3); font-size: 12.5px; }
    .chev { color: #b6c2cf; }
    ion-toggle { --track-background-checked: var(--gm-accent); }
    .sub { font-size: 17px; font-weight: 750; margin: 26px 0 8px; }
    .measure { display: flex; gap: 14px; padding: 12px 0; border-bottom: 1px solid var(--gm-line); }
    .measure ion-icon { flex: none; font-size: 22px; color: var(--gm-mint); margin-top: 2px; }
    .measure b { font-size: 15px; }
    .measure p { margin: 3px 0 0; font-size: 13.5px; color: var(--gm-ink-2); line-height: 1.45; }
  `,
})
export class SecuritySettingsPage implements OnInit {
  protected prefs = inject(PrefsService);
  protected lock = inject(AppLockService);
  protected auth = inject(AuthService);
  private toast = inject(ToastService);
  private platform = inject(PlatformService);
  readonly available = signal(false);

  readonly measures = [
    { icon: 'lock-closed-outline', title: 'Encrypted on device', body: 'Sign-in tokens live in the iOS Keychain / Android Keystore, never in plain storage.' },
    { icon: 'globe-outline', title: 'Encrypted in transit', body: 'All traffic uses HTTPS (TLS 1.2+). Plain HTTP requests are blocked by the app.' },
    { icon: 'eye-off-outline', title: 'Private in the app switcher', body: 'Your screen is hidden when Gatemate goes to the background.' },
    { icon: 'key-outline', title: 'Short-lived sessions', body: 'Access tokens expire after 15 minutes and refresh tokens rotate on every use.' },
    { icon: 'shield-outline', title: 'No tracking, no selling', body: 'We never sell your data or track you across other apps and websites.' },
  ];

  async ngOnInit() {
    this.available.set(await this.lock.isAvailable());
  }

  async toggleLock(on: boolean) {
    this.platform.selection();
    if (on && !(await this.lock.confirmPresence('Enable app lock'))) {
      await this.prefs.setBiometricLock(false);
      return;
    }
    await this.prefs.setBiometricLock(on);
    await this.toast.show(on ? 'App lock enabled' : 'App lock disabled', 'success');
  }

  async changePassword() {
    const email = this.auth.user()?.email;
    if (!email) return;
    await this.auth.requestPasswordReset(email).catch(() => {});
    await this.toast.show('Check your inbox for a reset link', 'success');
  }

  async signOutEverywhere() {
    await this.auth.logout();
    await this.toast.show('Signed out on all devices', 'success');
  }
}
