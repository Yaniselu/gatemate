import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, NavController } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { ApiError } from '../../core/services/api';
import { emailValidator } from '../../core/security/validators';
import { PlatformService } from '../../core/services/platform.service';
import { SocialButtonsComponent } from '../../shared/components/social-buttons.component';

@Component({
  selector: 'gm-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonIcon, ReactiveFormsModule, RouterLink, SocialButtonsComponent],
  templateUrl: './login.page.html',
  styleUrl: './auth.scss',
})
export class LoginPage {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
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
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.loginWithPassword(email, password);
      this.platform.success();
      await this.nav.navigateRoot('/tabs/home');
    } catch (e) {
      this.platform.error();
      this.error.set(e instanceof ApiError ? e.message : 'Could not sign in. Please try again.');
      this.form.controls.password.reset('');
      // The banner explains what went wrong; don't also flag the now-empty field as a validation error.
      this.submitted.set(false);
    } finally {
      this.loading.set(false);
    }
  }
}
