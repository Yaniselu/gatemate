import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { IonContent, IonIcon, NavController } from '@ionic/angular/standalone';
import { Preferences } from '@capacitor/preferences';
import { AuthService } from '../../core/services/auth.service';
import { PrefsService } from '../../core/services/prefs.service';
import { AirportDbService, AirportRecord } from '../../core/services/airport-db.service';
import { LocationService } from '../../core/services/location.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { PlatformService } from '../../core/services/platform.service';
import { ToastService } from '../../core/services/toast.service';
import { AirportPickerComponent } from '../../shared/components/airport-picker.component';
import { TranslatePipe } from '../../core/i18n/i18n.service';

/** Key stored per account once the first-run questions are answered (or skipped). */
export const onboardedKey = (userId: string) => `gm_onboarded_${userId}`;

/** First run after sign-in: home airport, then notifications. Both can be skipped and changed later. */
@Component({
  selector: 'gm-onboarding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonContent, IonIcon, AirportPickerComponent],
  template: `
    <ion-content [fullscreen]="true">
      <div class="wrap">
        <div class="dots" aria-hidden="true">
          <span [class.on]="step() === 0"></span><span [class.on]="step() === 1"></span>
        </div>

        @if (step() === 0) {
          <section class="step anim-fade-up">
            <span class="icon"><ion-icon name="airplane" /></span>
            <h1>{{ 'Where do you usually fly from?' | t }}</h1>
            <p>{{ 'We use your home airport for the airport guide, time differences, currency and plug checks. You can change it any time in your profile.' | t }}</p>

            @if (home(); as h) {
              <button class="choice card" (click)="picking.set(true)">
                <span class="code">{{ h.iata }}</span>
                <span class="txt"><b>{{ h.city }}</b><small>{{ h.name }}</small></span>
                <ion-icon name="create-outline" />
              </button>
            }

            <div class="actions">
              <button class="gm-btn ghost" (click)="useLocation()" [disabled]="locating()">
                @if (locating()) { <span class="spinner dark"></span> } @else { <ion-icon name="navigate-outline" /> }
                {{ 'Use my location' | t }}
              </button>
              <button class="gm-btn ghost" (click)="picking.set(true)"><ion-icon name="search-outline" /> {{ 'Search airports' | t }}</button>
            </div>

            <div class="bottom">
              <button class="gm-btn" (click)="saveHome()" [disabled]="!home() || saving()">
                @if (saving()) { <span class="spinner"></span> } @else { {{ 'Continue' | t }} <ion-icon name="arrow-forward" /> }
              </button>
              <button class="skip" (click)="step.set(1)">{{ 'Skip for now' | t }}</button>
            </div>
          </section>
        } @else {
          <section class="step anim-fade-up">
            <span class="icon"><ion-icon name="notifications" /></span>
            <h1>{{ 'Never miss boarding' | t }}</h1>
            <p>{{ 'Gatemate reminds you when check-in opens, when to leave for the airport and when boarding starts — and tells you about gate changes and delays.' | t }}</p>
            <ul class="list">
              <li><ion-icon name="checkmark-circle" /> {{ 'Only about your own trips' | t }}</li>
              <li><ion-icon name="checkmark-circle" /> {{ 'No marketing' | t }}</li>
              <li><ion-icon name="checkmark-circle" /> {{ 'Choose exactly which ones in Settings' | t }}</li>
            </ul>
            <div class="bottom">
              <button class="gm-btn" (click)="allowNotifications()" [disabled]="saving()">{{ 'Allow notifications' | t }}</button>
              <button class="skip" (click)="finish()">{{ 'Not now' | t }}</button>
            </div>
          </section>
        }
      </div>
      @if (picking()) {
        <gm-airport-picker (picked)="choose($event)" (closed)="picking.set(false)" />
      }
    </ion-content>
  `,
  styles: `
    .wrap { min-height: 100%; display: flex; flex-direction: column; padding: calc(env(safe-area-inset-top) + 20px) 22px calc(env(safe-area-inset-bottom) + 24px); }
    .dots { display: flex; gap: 6px; justify-content: center; margin-bottom: 26px; }
    .dots span { width: 8px; height: 8px; border-radius: 4px; background: #dfe5eb; transition: width .35s var(--gm-ease-spring), background .3s; }
    .dots span.on { width: 22px; background: var(--gm-accent-strong); }
    .step { flex: 1; display: flex; flex-direction: column; }
    .icon { width: 60px; height: 60px; border-radius: 18px; display: flex; align-items: center; justify-content: center; font-size: 28px; color: var(--gm-accent-strong); background: var(--gm-accent-soft); margin-bottom: 18px; }
    h1 { margin: 0 0 8px; font-size: 28px; font-weight: 750; letter-spacing: -0.02em; }
    p { margin: 0 0 20px; color: var(--gm-ink-2); font-size: 15.5px; line-height: 1.5; }
    .choice { display: flex; align-items: center; gap: 14px; width: 100%; padding: 14px; text-align: left; color: var(--gm-ink); margin-bottom: 12px; animation: gm-pop .45s var(--gm-ease-spring); }
    .choice .code { font-size: 22px; font-weight: 800; color: var(--gm-accent-strong); min-width: 52px; }
    .choice .txt { flex: 1; min-width: 0; }
    .choice b { display: block; font-size: 16px; }
    .choice small { display: block; color: var(--gm-ink-3); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .choice ion-icon { color: var(--gm-ink-3); font-size: 20px; }
    .actions { display: grid; gap: 10px; }
    .list { list-style: none; padding: 0; margin: 0 0 12px; display: grid; gap: 10px; }
    .list li { display: flex; align-items: center; gap: 10px; font-size: 15px; }
    .list ion-icon { color: var(--gm-mint); font-size: 20px; }
    .bottom { margin-top: auto; padding-top: 24px; display: grid; gap: 6px; }
    .skip { background: none; height: 44px; color: var(--gm-ink-3); font-weight: 600; font-size: 15px; }
    .spinner.dark { border-color: rgba(11,27,43,.15); border-top-color: var(--gm-ink); }
  `,
})
export class OnboardingPage implements OnInit {
  private auth = inject(AuthService);
  private prefs = inject(PrefsService);
  private db = inject(AirportDbService);
  private location = inject(LocationService);
  private notifications = inject(NotificationsService);
  private platform = inject(PlatformService);
  private toast = inject(ToastService);
  private nav = inject(NavController);

  readonly step = signal(0);
  readonly home = signal<AirportRecord | undefined>(undefined);
  readonly picking = signal(false);
  readonly locating = signal(false);
  readonly saving = signal(false);

  async ngOnInit() {
    await this.db.load();
    const current = this.auth.user()?.homeAirport;
    if (current) this.home.set(this.db.get(current));
  }

  choose(a: AirportRecord) {
    this.picking.set(false);
    this.platform.selection();
    this.home.set(a);
  }

  async useLocation() {
    this.locating.set(true);
    try {
      const fix = await this.location.locate();
      if (!fix) {
        void this.toast.show('Location is off. Search for your airport instead.');
        return;
      }
      const n = this.db.nearest(fix.lat, fix.lon);
      if (n) {
        this.home.set(n.airport);
        this.platform.success();
      }
    } finally {
      this.locating.set(false);
    }
  }

  async saveHome() {
    const h = this.home();
    if (!h) return;
    this.saving.set(true);
    try {
      await this.auth.updateProfile({ homeAirport: h.iata });
      await this.prefs.setHomeAirport(h.iata);
      this.step.set(1);
    } catch {
      void this.toast.show('Couldn’t save your home airport. Check your connection.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async allowNotifications() {
    this.saving.set(true);
    try {
      const ok = await this.notifications.requestPermission();
      if (!ok && this.platform.isNative) void this.toast.show('You can turn notifications on later in Settings.');
    } finally {
      this.saving.set(false);
      await this.finish();
    }
  }

  async finish() {
    const id = this.auth.user()?.id;
    if (id) await Preferences.set({ key: onboardedKey(id), value: '1' }).catch(() => {});
    void this.nav.navigateRoot('/tabs/home', { animationDirection: 'forward' });
  }
}
