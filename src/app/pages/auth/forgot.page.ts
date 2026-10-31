import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { emailValidator, passwordStrength } from '../../core/security/validators';
import { PlatformService } from '../../core/services/platform.service';
import { ApiError } from '../../core/services/api';
import { CodeInputComponent } from '../../shared/components/code-input.component';
import { t, TranslatePipe } from '../../core/i18n/i18n.service';

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
            <div style="--i: 2"><gm-code-input [(value)]="code" [error]="codeError()" (complete)="focusPassword()" /></div>
            <div class="gm-field" style="--i: 3; margin-top: 18px">
              <label for="np">{{ 'New password' | t }}</label>
              <div class="gm-input-wrap">
                <ion-icon name="lock-closed-outline" />
                <input #np id="np" [type]="show() ? 'text' : 'password'" autocomplete="new-password" [value]="password()" (input)="password.set($any($event.target).value); error.set('')" (keydown.enter)="confirm()" maxlength="128" enterkeyhint="done" />
                <button type="button" class="eye" (click)="show.set(!show())" [attr.aria-label]="show() ? ('Hide password' | t) : ('Show password' | t)"><ion-icon [name]="show() ? 'eye-off-outline' : 'eye-outline'" /></button>
              </div>
              @let s = strength();
              <div class="checks">
                <span [class.ok]="s.checks.length"><ion-icon [name]="s.checks.length ? 'checkmark' : 'remove-outline'" />{{ '10+ chars' | t }}</span>
                <span [class.ok]="s.checks.upper && s.checks.lower"><ion-icon [name]="s.checks.upper && s.checks.lower ? 'checkmark' : 'remove-outline'" />{{ 'Aa' | t }}</span>
                <span [class.ok]="s.checks.digit"><ion-icon [name]="s.checks.digit ? 'checkmark' : 'remove-outline'" />123</span>
                <span [class.ok]="s.checks.symbol"><ion-icon [name]="s.checks.symbol ? 'checkmark' : 'remove-outline'" />#!?</span>
              </div>
            </div>
            @if (error()) { <p class="err" role="alert"><ion-icon name="alert-circle" /> {{ error() }}</p> }
            <button class="gm-btn" style="--i: 4" (click)="confirm()" [disabled]="loading()">
              @if (loading()) { <span class="spinner"></span> } @else { {{ 'Set new password' | t }} <ion-icon name="checkmark" /> }
            </button>
            <button class="link" (click)="restart()">{{ 'Use another e-mail or send a new code' | t }}</button>
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
    .checks { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 0; }
    .checks span { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; padding: 4px 9px; border-radius: 999px; background: var(--gm-surface); color: var(--gm-ink-3); transition: background .3s, color .3s; }
    .checks span.ok { background: rgba(47, 209, 138, .14); color: #138a57; }
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
  readonly codeError = signal(false);
  readonly strength = computed(() => passwordStrength(this.password()));
  private np = viewChild<ElementRef<HTMLInputElement>>('np');

  focusPassword() {
    this.codeError.set(false);
    this.error.set('');
    setTimeout(() => this.np()?.nativeElement.focus(), 50);
  }

  restart() {
    this.sent.set(false);
    this.code.set('');
    this.error.set('');
    this.codeError.set(false);
  }

  async submit() {
    this.submitted.set(true);
    this.error.set('');
    if (this.form.invalid) {
      this.platform.error();
      return;
    }
    this.loading.set(true);
    try {
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
    if (this.loading()) return;
    this.error.set('');
    this.codeError.set(false);
    if (this.code().length !== 6) {
      this.codeError.set(true);
      this.error.set(t('Enter the 6-digit code from the e-mail.'));
      this.platform.error();
      return;
    }
    if (!Object.values(this.strength().checks).every(Boolean)) {
      this.error.set(t('Use at least 10 characters with upper and lower case letters, a number and a symbol.'));
      this.platform.error();
      this.np()?.nativeElement.focus();
      return;
    }
    this.loading.set(true);
    try {
      await this.auth.confirmPasswordReset(this.form.getRawValue().email, this.code(), this.password());
      this.changed.set(true);
      this.platform.success();
    } catch (e) {
      this.platform.error();
      if (e instanceof ApiError && e.code === 'invalid_code') this.codeError.set(true);
      this.error.set(e instanceof ApiError ? e.message : t('Couldn’t change the password. Please try again.'));
    } finally {
      this.loading.set(false);
    }
  }
}
