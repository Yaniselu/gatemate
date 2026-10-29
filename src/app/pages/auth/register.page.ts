import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, NavController } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { ApiError } from '../../core/services/api';
import { emailValidator, nameValidator, passwordNotContainingEmail, passwordStrength, strongPasswordValidator } from '../../core/security/validators';
import { PlatformService } from '../../core/services/platform.service';
import { SocialButtonsComponent } from '../../shared/components/social-buttons.component';

@Component({
  selector: 'gm-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonIcon, ReactiveFormsModule, RouterLink, SocialButtonsComponent],
  templateUrl: './register.page.html',
  styleUrls: ['./auth.scss', './register.page.scss'],
})
export class RegisterPage {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  readonly socialAvailable = this.auth.providerAvailable('apple') || this.auth.providerAvailable('google');
  private nav = inject(NavController);
  private platform = inject(PlatformService);

  readonly form = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.maxLength(60), nameValidator]],
      email: ['', [Validators.required, Validators.maxLength(254), emailValidator]],
      password: ['', [Validators.required, strongPasswordValidator]],
      age: [false, Validators.requiredTrue],
      terms: [false, Validators.requiredTrue],
    },
    { validators: passwordNotContainingEmail('password', 'email') },
  );

  private password = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });
  readonly strength = computed(() => passwordStrength(this.password()));
  readonly showPassword = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly submitted = signal(false);
  /** Shown when the server takes a while (a free-tier server waking up). */
  readonly slow = signal(false);

  invalid(name: 'name' | 'email' | 'password' | 'age' | 'terms'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || this.submitted());
  }

  async submit() {
    this.submitted.set(true);
    this.error.set(null);
    if (this.form.hasError('passwordContainsEmail')) {
      this.error.set('Your password must not contain your email name.');
    }
    if (this.form.invalid) {
      this.platform.error();
      return;
    }
    this.loading.set(true);
    const slowTimer = setTimeout(() => this.slow.set(true), 6000);
    try {
      const { name, email, password } = this.form.getRawValue();
      await this.auth.register(name, email, password);
      this.platform.success();
      // The confirmation code is already on its way (when this server sends e-mail).
      await this.nav.navigateRoot((await this.auth.emailCodes()) ? '/verify-email' : '/tabs/home');
    } catch (e) {
      this.platform.error();
      this.error.set(e instanceof ApiError ? e.message : 'Could not create your account. Please try again.');
    } finally {
      clearTimeout(slowTimer);
      this.slow.set(false);
      this.loading.set(false);
    }
  }
}
