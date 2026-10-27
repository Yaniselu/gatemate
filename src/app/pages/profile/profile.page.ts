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

@Component({
  selector: 'gm-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, RouterLink, SkeletonComponent, CountUpDirective, RevealDirective, PressableDirective, SheenDirective],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage implements OnInit {
  protected auth = inject(AuthService);
  protected store = inject(TravelStore);
  protected prefs = inject(PrefsService);
  private chat = inject(ChatService);
  private api = inject(GatemateApi);
  private alerts = inject(AlertController);
  private toast = inject(ToastService);
  private lock = inject(AppLockService);
  protected review = inject(ReviewService);

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
  readonly earnedCount = computed(() => this.store.stats()?.badges.filter((b) => b.earned).length ?? 0);

  ngOnInit(): void {
    void this.store.loadStats();
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
      header: 'Sign out?',
      message: 'Your trips stay safe in your account.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Sign out',
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
      header: 'Delete account',
      message: 'This permanently deletes your profile, trips, boarding passes and messages. Type DELETE to confirm.',
      inputs: [{ name: 'confirm', type: 'text', placeholder: 'DELETE', attributes: { autocapitalize: 'characters', maxlength: 10 } }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete forever',
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
