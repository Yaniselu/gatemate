import { ShortDatePipe } from '../../shared/pipes/time.pipes';
import { ProService } from '../../core/services/pro.service';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertController, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { TravelStore } from '../../core/services/travel.store';
import { ChatService } from '../../core/services/chat.service';
import { GatemateApi } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { PrefsService } from '../../core/services/prefs.service';
import { AppLockService } from '../../core/security/app-lock.service';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { CountUpDirective } from '../../shared/directives/count-up.directive';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { PressableDirective } from '../../shared/directives/pressable.directive';
import { SheenDirective } from '../../shared/directives/sheen.directive';
import { ReviewService } from '../../core/services/review.service';
import { AchievementsService } from '../../core/services/achievements.service';
import { AirportDbService } from '../../core/services/airport-db.service';
import { summarize } from '../../core/utils/travel-summary';
import { I18nService, Lang, LANGUAGES, t as tr, TranslatePipe } from '../../core/i18n/i18n.service';

@Component({
  selector: 'gm-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, RouterLink, SkeletonComponent, CountUpDirective, RevealDirective, PressableDirective, SheenDirective, ShortDatePipe],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage implements OnInit {
  protected pro = inject(ProService);
  protected auth = inject(AuthService);
  protected i18n = inject(I18nService);
  readonly languages = LANGUAGES;
  readonly langOpen = signal(false);
  readonly currentLang = computed(() => LANGUAGES.find((l) => l.code === this.i18n.lang()) ?? LANGUAGES[0]);

  setLang(code: Lang) {
    if (code === this.i18n.lang()) return;
    void this.i18n.use(code);
  }
  protected store = inject(TravelStore);
  protected prefs = inject(PrefsService);
  private chat = inject(ChatService);
  private api = inject(GatemateApi);
  private alerts = inject(AlertController);
  private toast = inject(ToastService);
  private lock = inject(AppLockService);
  protected review = inject(ReviewService);
  protected ach = inject(AchievementsService);
  private db = inject(AirportDbService);

  /** Computed from the user's own completed flights — no estimates. */
  readonly travel = computed(() => {
    this.db.ready();
    const s = summarize(this.store.trips().flatMap((t) => t.flights), (c) => this.db.get(c));
    return { flights: s.flights, km: s.km, countries: s.countries.length, hours: s.hours };
  });
  readonly recentBadges = computed(() => {
    const list = this.ach.badges();
    const earned = list.filter((b) => b.earned).sort((x, y) => (y.earnedAt ?? '').localeCompare(x.earnedAt ?? ''));
    const next = list.filter((b) => !b.earned).sort((x, y) => y.progress - x.progress);
    return [...earned, ...next].slice(0, 6);
  });

  readonly exporting = signal(false);
  readonly initials = computed(() =>
    (this.auth.user()?.name ?? '?')
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
  );
  readonly providerLabel = computed(() => ({ apple: 'Apple ID', google: 'Google', password: 'Email' })[this.auth.user()?.provider ?? 'password']);
  readonly version = '1.0.0';

  ngOnInit(): void {
    void this.store.loadTrips();
    void this.db.load();
    void this.ach.load();
  }

  async exportData() {
    this.exporting.set(true);
    try {
      const blob = await this.api.exportMyData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gatemate-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      await this.toast.show('Your data export is ready', 'success');
    } catch {
      await this.toast.show('Export failed. Please try again.', 'error');
    } finally {
      this.exporting.set(false);
    }
  }

  async signOut() {
    const alert = await this.alerts.create({
      header: tr('Sign out?'),
      message: tr('Your trips stay safe in your account.'),
      buttons: [
        { text: tr('Cancel'), role: 'cancel' },
        {
          text: tr('Sign out'),
          role: 'destructive',
          handler: () => {
            this.store.reset();
            this.chat.reset();
            void this.auth.logout();
          },
        },
      ],
    });
    await alert.present();
  }

  /** App Store guideline 5.1.1(v): accounts created in-app must be deletable in-app. */
  async deleteAccount() {
    const alert = await this.alerts.create({
      header: tr('Delete account'),
      message: (this.pro.isPro() ? tr('Deleting your account does not cancel your Gatemate Pro subscription — cancel it in your App Store / Google Play settings first.') + ' ' : '') + tr('This permanently deletes your profile, trips, boarding passes and messages. Type DELETE to confirm.'),
      inputs: [{ name: 'confirm', type: 'text', placeholder: 'DELETE', attributes: { autocapitalize: 'characters', maxlength: 10 } }],
      buttons: [
        { text: tr('Cancel'), role: 'cancel' },
        {
          text: tr('Delete forever'),
          role: 'destructive',
          handler: (data: { confirm?: string }) => {
            if ((data.confirm ?? '').trim().toUpperCase() !== 'DELETE') {
              void this.toast.show('Type DELETE to confirm.', 'error');
              return false;
            }
            void this.confirmDelete();
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private async confirmDelete() {
    if (!(await this.lock.confirmPresence('Confirm account deletion'))) return;
    try {
      await this.auth.deleteAccount();
      this.store.reset();
      this.chat.reset();
      await this.prefs.reset();
      await this.toast.show('Your account has been deleted.', 'success');
    } catch {
      await this.toast.show('Could not delete your account. Please try again.', 'error');
    }
  }
}
