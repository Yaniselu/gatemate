import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { IonContent, IonIcon, NavController } from '@ionic/angular/standalone';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { ApiError } from '../../core/services/api';
import { PlatformService } from '../../core/services/platform.service';
import { CodeInputComponent } from '../../shared/components/code-input.component';
import { ConfettiService } from '../../shared/components/confetti.service';

/** "Check your inbox": type the 6-digit code from the confirmation e-mail. */
@Component({
  selector: 'gm-verify-email',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonIcon, CodeInputComponent],
  template: `
    <ion-content class="auth">
      <div class="wrap">
        @if (!done()) {
          <div class="stagger">
            <div class="env" style="--i: 0"><ion-icon name="mail-unread-outline" /></div>
            <h1 style="--i: 1">Confirm your e-mail</h1>
            <p class="lead" style="--i: 2">We sent a 6-digit code to <b>{{ email() }}</b>. Type it here.@if (demo) { <br /><small class="demo">Demo: the code is 246810</small> }</p>
            <div style="--i: 3">
              <gm-code-input [(value)]="code" [error]="!!error()" (complete)="verify()" />
            </div>
            @if (error()) { <p class="err" role="alert"><ion-icon name="alert-circle" /> {{ error() }}</p> }
            <button class="gm-btn" style="--i: 4" (click)="verify()" [disabled]="busy() || code().length !== 6">
              @if (busy()) { <span class="spinner"></span> } @else { Confirm <ion-icon name="checkmark" /> }
            </button>
            <div class="row" style="--i: 5">
              <button class="link" (click)="resend()" [disabled]="cooldown() > 0 || sending()">
                {{ sending() ? 'Sending…' : cooldown() > 0 ? 'Resend code in ' + cooldown() + 's' : 'Resend code' }}
              </button>
              <button class="link muted" (click)="later()">Later</button>
            </div>
            <p class="hint" style="--i: 6">Can’t find it? Check Spam or Promotions. The code expires in 30 minutes.</p>
          </div>
        } @else {
          <div class="done">
            <div class="env ok"><ion-icon name="checkmark" /></div>
            <h1>E-mail confirmed</h1>
            <p class="lead">Thanks! Your account is secured.</p>
          </div>
        }
      </div>
    </ion-content>
  `,
  styleUrl: '../auth/auth.scss',
  styles: `
    .env { width: 84px; height: 84px; margin: 10px 0 18px; border-radius: 28px; display: flex; align-items: center; justify-content: center; font-size: 40px;
      color: var(--gm-accent-strong); background: var(--gm-accent-soft); animation: gm-float 3s ease-in-out infinite; }
    .env.ok { margin: 60px auto 18px; color: #fff; background: var(--gm-mint); animation: gm-pop .6s var(--gm-ease-spring); }
    .done { text-align: center; }
    .demo { color: var(--gm-accent-deep); font-weight: 700; }
    .gm-btn { margin-top: 18px; }
    .err { display: flex; gap: 6px; align-items: center; margin: 12px 2px 0; color: #c0392b; font-weight: 600; font-size: 14px; }
    .row { display: flex; justify-content: space-between; margin-top: 16px; }
    .link { background: none; font-weight: 700; font-size: 15px; color: var(--gm-accent-strong); padding: 8px 2px; }
    .link:disabled { color: var(--gm-ink-3); }
    .link.muted { color: var(--gm-ink-3); }
    .hint { margin-top: 18px; font-size: 13px; color: var(--gm-ink-3); }
  `,
})
export class VerifyEmailPage {
  private auth = inject(AuthService);
  private platform = inject(PlatformService);
  private nav = inject(NavController);
  private confetti = inject(ConfettiService);

  readonly demo = environment.useMocks;
  readonly email = computed(() => this.auth.user()?.email ?? 'your e-mail');
  readonly code = signal('');
  readonly error = signal('');
  readonly busy = signal(false);
  readonly sending = signal(false);
  readonly done = signal(false);
  /** Seconds before another code can be sent (the server allows one a minute). */
  readonly cooldown = signal(60);

  constructor() {
    const t = setInterval(() => this.cooldown.update((s) => Math.max(0, s - 1)), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
    if (this.auth.user()?.emailVerified) void this.nav.navigateRoot('/tabs/home');
  }

  async verify() {
    if (this.busy() || this.code().length !== 6) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.verifyEmail(this.code());
      this.done.set(true);
      this.platform.success();
      this.confetti.burst(0.5, 0.3, 90);
      setTimeout(() => void this.nav.navigateRoot('/tabs/home'), 1400);
    } catch (e) {
      this.platform.error();
      this.error.set(e instanceof ApiError ? e.message : 'Couldn’t check the code. Please try again.');
      this.code.set('');
    } finally {
      this.busy.set(false);
    }
  }

  async resend() {
    this.sending.set(true);
    this.error.set('');
    try {
      await this.auth.sendVerificationCode();
      this.cooldown.set(60);
      this.platform.success();
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'Couldn’t send a new code. Please try again.');
      if (e instanceof ApiError && e.retryAfterSeconds) this.cooldown.set(e.retryAfterSeconds);
    } finally {
      this.sending.set(false);
    }
  }

  later() {
    void this.nav.navigateRoot('/tabs/home');
  }
}
