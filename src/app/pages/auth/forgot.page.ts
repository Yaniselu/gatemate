import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { emailValidator } from '../../core/security/validators';
import { PlatformService } from '../../core/services/platform.service';
import { ApiError } from '../../core/services/api';
import { CodeInputComponent } from '../../shared/components/code-input.component';
import { TranslatePipe } from '../../core/i18n/i18n.service';

@Component({
  selector: 'gm-forgot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonContent, IonIcon, ReactiveFormsModule, RouterLink, CodeInputComponent],
  template: `
    <ion-content class="auth">
      <div class="wrap">
        <a class="gm-icon-btn back" routerLink="/auth/login" [aria-label]="'Back to sign in' | t"><ion-icon name="chevron-back" /></a>

        @if (!sent()) {
          <div class="stagger">
            <h1 style="--i: 0">{{ 'Reset password' | t }}</h1>
            <p class="lead" style="--i: 1">{{ 'Enter your e-mail and we’ll send you a 6-digit code to choose a new password.' | t }}</p>
            <form [formGroup]="form" (ngSubmit)="submit()" novalidate style="--i: 2">
              <div class="gm-field" [class.invalid]="form.controls.email.invalid && submitted()">
                <label for="email">{{ 'Email' | t }}</label>
                <div class="gm-input-wrap">
                  <ion-icon name="mail-outline" />
                  <input id="email" type="email" formControlName="email" autocomplete="email" inputmode="email" autocapitalize="off" [placeholder]="'you@example.com' | t" />
                </div>
                @if (form.controls.email.invalid && submitted()) {
                  <span class="gm-error">{{ 'Enter a valid email address.' | t }}</span>
                }
              </div>
              <button class="gm-btn" type="submit" [disabled]="loading()">
                @if (loading()) { <span class="spinner"></span> } @else { {{ 'Send code' | t }} <ion-icon name="send" /> }
              </button>
              @if (error()) { <p class="err" role="alert"><ion-icon name="alert-circle" /> {{ error() }}</p> }
            </form>
          </div>
        } @else if (!changed()) {
          <div class="stagger">
            <h1 style="--i: 0">{{ 'Enter the code' | t }}</h1>
            <p class="lead" style="--i: 1">{{ 'If an account exists for' | t }} <b>{{ form.controls.email.value }}</b>{{ ', we e-mailed it a 6-digit code. It expires in 30 minutes.' | t }}</p>
            <div style="--i: 2"><gm-code-input [(value)]="code" [error]="!!error()" /></div>
            <div class="gm-field" style="--i: 3; margin-top: 18px">
              <label for="np">{{ 'New password' | t }}</label>
              <div class="gm-input-wrap">
                <ion-icon name="lock-closed-outline" />
                <input id="np" [type]="show() ? 'text' : 'password'" autocomplete="new-password" [value]="password()" (input)="password.set($any($event.target).value)" maxlength="128" />
                <button type="button" class="eye" (click)="show.set(!show())" [attr.aria-label]="show() ? ('Hide password' | t) : ('Show password' | t)"><ion-icon [name]="show() ? 'eye-off-outline' : 'eye-outline'" /></button>
              </div>
              <span class="gm-hint">{{ 'At least 10 characters, with letters and a number or symbol.' | t }}</span>
            </div>
            @if (error()) { <p class="err" role="alert"><ion-icon name="alert-circle" /> {{ error() }}</p> }
            <button class="gm-btn" style="--i: 4" (click)="confirm()" [disabled]="loading() || code().length !== 6 || password().length < 10">
              @if (loading()) { <span class="spinner"></span> } @else { {{ 'Set new password' | t }} <ion-icon name="checkmark" /> }
            </button>
            <button class="link" (click)="sent.set(false); code.set('')">{{ 'Use another e-mail or send a new code' | t }}</button>
          </div>
        } @else {
          <div class="sent">
            <div class="env"><ion-icon name="lock-open-outline" /><span class="tick"><ion-icon name="checkmark" /></span></div>
            <h1>{{ 'Password changed' | t }}</h1>
            <p class="lead">{{ 'You can sign in with your new password. For your safety, other devices were signed out.' | t }}</p>
            <a class="gm-btn" routerLink="/auth/login">{{ 'Sign in' | t }}</a>
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
    .gm-btn { margin-top: 16px; text-decoration: none; }
    .err { display: flex; gap: 6px; align-items: center; margin: 12px 2px 0; color: #c0392b; font-weight: 600; font-size: 14px; }
    .link { display: block; margin: 16px auto 0; background: none; color: var(--gm-accent-strong); font-weight: 700; font-size: 14px; }
    .eye { background: none; color: var(--gm-ink-3); font-size: 20px; display: flex; }
  `,
})
export class ForgotPage {
  private auth = inject(AuthService);
  private platform = inject(PlatformService);
  readonly form = inject(FormBuilder).nonNullable.group({ email: ['', [Validators.required, emailValidator]] });
  readonly loading = signal(false);
  readonly sent = signal(false);
  readonly submitted = signal(false);
  readonly code = signal('');
  readonly password = signal('');
  readonly show = signal(false);
  readonly error = signal('');
  readonly changed = signal(false);

  async submit() {
    this.submitted.set(true);
    this.error.set('');
    if (this.form.invalid) {
      this.platform.error();
      return;
    }
    this.loading.set(true);
    try {
      // The answer is the same whether or not the account exists (no user enumeration).
      await this.auth.requestPasswordReset(this.form.getRawValue().email);
      this.sent.set(true);
      this.platform.success();
    } catch (e) {
      this.platform.error();
      this.error.set(e instanceof ApiError ? e.message : 'Couldn’t send the code. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async confirm() {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.confirmPasswordReset(this.form.getRawValue().email, this.code(), this.password());
      this.changed.set(true);
      this.platform.success();
    } catch (e) {
      this.platform.error();
      this.error.set(e instanceof ApiError ? e.message : 'Couldn’t change the password. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
