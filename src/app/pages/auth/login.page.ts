import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, NavController } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { ApiError } from '../../core/services/api';
import { emailValidator } from '../../core/security/validators';
import { PlatformService } from '../../core/services/platform.service';
import { SocialButtonsComponent } from '../../shared/components/social-buttons.component';
import { TranslatePipe } from '../../core/i18n/i18n.service';

@Component({
  selector: 'gm-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonContent, IonIcon, ReactiveFormsModule, RouterLink, SocialButtonsComponent],
  templateUrl: './login.page.html',
  styleUrl: './auth.scss',
})
export class LoginPage {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  readonly socialAvailable = this.auth.providerAvailable('apple') || this.auth.providerAvailable('google');
  private nav = inject(NavController);
  private platform = inject(PlatformService);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.maxLength(254), emailValidator]],
    password: ['', [Validators.required, Validators.maxLength(128)]],
  });
  readonly showPassword = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly submitted = signal(false);
  readonly slow = signal(false);

  invalid(name: 'email' | 'password'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || this.submitted());
  }

  async submit() {
    this.submitted.set(true);
    this.error.set(null);
    if (this.form.invalid) {
      this.platform.error();
      return;
    }
    this.loading.set(true);
    const slowTimer = setTimeout(() => this.slow.set(true), 6000);
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.loginWithPassword(email, password);
      this.platform.success();
      await this.nav.navigateRoot('/tabs/home');
    } catch (e) {
      this.platform.error();
      this.error.set(e instanceof ApiError ? e.message : 'Could not sign in. Please try again.');
      this.form.controls.password.reset('');
      this.submitted.set(false);
    } finally {
      clearTimeout(slowTimer);
      this.slow.set(false);
      this.loading.set(false);
    }
  }
}
