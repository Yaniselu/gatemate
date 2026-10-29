import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { IonContent, IonIcon, NavController } from '@ionic/angular/standalone';
import { ApiError, GatemateApi } from '../../core/services/api';
import { TravelStore } from '../../core/services/travel.store';
import { ChatService } from '../../core/services/chat.service';
import { PlatformService } from '../../core/services/platform.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';

/** Opened from a shared invite link: joins the trip or group, then goes there. */
@Component({
  selector: 'gm-invite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonContent, IonIcon],
  template: `
    <ion-content [fullscreen]="true">
      <div class="wrap">
        @if (error(); as e) {
          <div class="card glass strong box anim-fade-up">
            <span class="icon err"><ion-icon name="link-outline" /></span>
            <h1>{{ 'Invite unavailable' | t }}</h1>
            <p>{{ e }}</p>
            <button class="gm-btn" (click)="home()">{{ 'Go to Home' | t }}</button>
          </div>
        } @else {
          <div class="card glass strong box">
            <span class="icon"><ion-icon name="airplane" /></span>
            <h1>{{ 'Joining your crew…' | t }}</h1>
            <p>{{ 'Checking the invite link.' | t }}</p>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .wrap { min-height: 100%; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .box { width: 100%; max-width: 360px; padding: 28px 22px; text-align: center; }
    .icon { width: 64px; height: 64px; border-radius: 22px; margin: 0 auto 14px; display: flex; align-items: center; justify-content: center;
      font-size: 30px; color: #fff; background: linear-gradient(135deg, var(--gm-accent), var(--gm-accent-strong)); animation: gm-float 3s ease-in-out infinite; }
    .icon.err { background: linear-gradient(135deg, #ff8a8f, #e5484d); animation: none; }
    h1 { margin: 0 0 6px; font-size: 22px; }
    p { margin: 0 0 18px; color: var(--gm-ink-2); }
  `,
})
export class InvitePage implements OnInit {
  private api = inject(GatemateApi);
  private nav = inject(NavController);
  private store = inject(TravelStore);
  private chat = inject(ChatService);
  private platform = inject(PlatformService);

  readonly token = input.required<string>();
  readonly error = signal<string | null>(null);

  async ngOnInit() {
    try {
      const target = await this.api.acceptInvite(this.token());
      this.platform.success();
      if (target.type === 'trip') {
        await Promise.all([this.store.loadTrips(true), this.chat.loadThreads(true)]);
        void this.nav.navigateRoot(['/trip', target.id], { animated: true });
      } else {
        await this.chat.loadThreads(true);
        void this.nav.navigateRoot(['/chat', target.id], { animated: true });
      }
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'Check your connection and open the link again.');
    }
  }

  home() {
    void this.nav.navigateRoot('/tabs/home');
  }
}
