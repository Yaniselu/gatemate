import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { emailValidator } from '../../core/security/validators';
import { PlatformService } from '../../core/services/platform.service';

@Component({
  selector: 'gm-forgot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonIcon, ReactiveFormsModule, RouterLink],
  template: `
    <ion-content class="auth">
      <div class="wrap">
        <a class="gm-icon-btn back" routerLink="/auth/login" aria-label="Back to sign in"><ion-icon name="chevron-back" /></a>

        @if (!sent()) {
          <div class="stagger">
            <h1 style="--i: 0">Reset password</h1>
            <p class="lead" style="--i: 1">Enter your email and we will send you a secure reset link.</p>
            <form [formGroup]="form" (ngSubmit)="submit()" novalidate style="--i: 2">
              <div class="gm-field" [class.invalid]="form.controls.email.invalid && submitted()">
                <label for="email">Email</label>
                <div class="gm-input-wrap">
                  <ion-icon name="mail-outline" />
                  <input id="email" type="email" formControlName="email" autocomplete="email" inputmode="email" autocapitalize="off" placeholder="you@example.com" />
                </div>
                @if (form.controls.email.invalid && submitted()) {
                  <span class="gm-error">Enter a valid email address.</span>
                }
              </div>
              <button class="gm-btn" type="submit" [disabled]="loading()">
                @if (loading()) { <span class="spinner"></span> } @else { Send reset link <ion-icon name="send" /> }
              </button>
            </form>
          </div>
        } @else {
          <div class="sent">
            <div class="env"><ion-icon name="mail-outline" /><span class="tick"><ion-icon name="checkmark" /></span></div>
            <h1>Check your inbox</h1>
            <p class="lead">If an account exists for <b>{{ form.controls.email.value }}</b>, a reset link is on its way. It expires in 30 minutes.</p>
            <a class="gm-btn ghost" routerLink="/auth/login">Back to sign in</a>
          </div>
        }
      </div>
    </ion-content>
  `,
  styleUrl: './auth.scss',
  styles: `
    .sent { text-align: center; margin-top: 40px; animation: gm-fade-up .5s var(--gm-ease-out); }
    .env { position: relative; width: 96px; height: 96px; margin: 0 auto 18px; border-radius: 32px; display: flex; align-items: center; justify-content: center; font-size: 44px; color: var(--gm-accent-strong); background: var(--gm-accent-soft); animation: gm-float 3s ease-in-out infinite; }
    .tick { position: absolute; right: -6px; top: -6px; width: 34px; height: 34px; border-radius: 50%; background: var(--gm-mint); color: #fff; font-size: 20px; display: flex; align-items: center; justify-content: center; border: 3px solid #fff; animation: gm-pop .6s var(--gm-ease-spring) .3s both; }
    .gm-btn.ghost { text-decoration: none; margin-top: 10px; }
  `,
})
export class ForgotPage {
  private auth = inject(AuthService);
  private platform = inject(PlatformService);
  readonly form = inject(FormBuilder).nonNullable.group({ email: ['', [Validators.required, emailValidator]] });
  readonly loading = signal(false);
  readonly sent = signal(false);
  readonly submitted = signal(false);

  async submit() {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.platform.error();
      return;
    }
    this.loading.set(true);
    // The response is identical whether or not the account exists (no user enumeration).
    await this.auth.requestPasswordReset(this.form.getRawValue().email).catch(() => {});
    this.loading.set(false);
    this.sent.set(true);
    this.platform.success();
  }
}
