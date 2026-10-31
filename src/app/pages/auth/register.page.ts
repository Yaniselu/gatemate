import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, NavController } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { ApiError } from '../../core/services/api';
import { emailValidator, passwordNotContainingEmail, passwordStrength, strongPasswordValidator } from '../../core/security/validators';
import { PlatformService } from '../../core/services/platform.service';
import { SocialButtonsComponent } from '../../shared/components/social-buttons.component';
import { currentLang, I18nService, Lang, LANGUAGES, locale, t as tr, TranslatePipe } from '../../core/i18n/i18n.service';
import { AirportDbService } from '../../core/services/airport-db.service';

const LEGAL = /^[\p{L}][\p{L}\p{M}' -]{0,39}$/u;
const DRAFT = 'gm_register_draft';
const LANG_OF: Record<string, Lang> = {
  RO: 'ro', MD: 'ro',
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es', EC: 'es', GT: 'es', CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es', SV: 'es', NI: 'es', CR: 'es', PA: 'es', UY: 'es', PR: 'es', GQ: 'es',
  FR: 'fr', MC: 'fr', LU: 'fr', BE: 'fr', SN: 'fr', CI: 'fr', CM: 'fr', MG: 'fr', ML: 'fr', BF: 'fr', NE: 'fr', TG: 'fr', BJ: 'fr', GA: 'fr', CG: 'fr', CD: 'fr', HT: 'fr',
  DE: 'de', AT: 'de', LI: 'de', CH: 'de',
  IT: 'it', SM: 'it', VA: 'it',
  GB: 'en', US: 'en', IE: 'en', AU: 'en', NZ: 'en', CA: 'en', MT: 'en', ZA: 'en', IN: 'en', SG: 'en',
};

function langOf(country: string): Lang | undefined {
  return LANG_OF[country];
}

function readDraft(): { country?: string; firstName?: string; lastName?: string; email?: string } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(DRAFT) || 'null');
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

@Component({
  selector: 'gm-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonContent, IonIcon, ReactiveFormsModule, RouterLink, SocialButtonsComponent],
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
      country: [''],
      firstName: ['', [Validators.required, Validators.pattern(LEGAL)]],
      lastName: ['', [Validators.required, Validators.pattern(LEGAL)]],
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
  readonly slow = signal(false);

  private db = inject(AirportDbService);
  private i18n = inject(I18nService);
  readonly countries = signal<{ code: string; name: string }[]>([]);
  readonly langNote = signal('');

  constructor() {
    const saved = readDraft();
    if (saved) this.form.patchValue(saved);
    if (!this.form.controls.country.value) {
      const region = (navigator.languages?.find((l) => /-[A-Z]{2}$/i.test(l)) ?? '').split('-').pop()?.toUpperCase() ?? '';
      if (region) this.form.controls.country.setValue(region);
    }
    void this.db.load().then(() => {
      const names = this.db.countryCodes().map((code) => ({ code, name: this.db.countryName(code) }));
      names.sort((a, b) => a.name.localeCompare(b.name, locale()));
      this.countries.set(names);
      if (!names.some((c) => c.code === this.form.controls.country.value)) this.form.controls.country.setValue('');
      const l = langOf(this.form.controls.country.value);
      if (l && l === currentLang() && saved?.country) this.langNote.set(tr('The app is now in {lang}.', { lang: LANGUAGES.find((x) => x.code === l)!.name }));
    });
  }

  flag(code: string) {
    return /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '🌍';
  }

  persist() {
    const { country, firstName, lastName, email } = this.form.getRawValue();
    try {
      sessionStorage.setItem(DRAFT, JSON.stringify({ country, firstName, lastName, email }));
    } catch {
      return;
    }
  }

  async countryChanged() {
    this.platform.selection();
    this.persist();
    const l = langOf(this.form.controls.country.value);
    if (l && l !== currentLang()) await this.i18n.use(l);
  }

  invalid(name: 'firstName' | 'lastName' | 'email' | 'password' | 'age' | 'terms'): boolean {
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
      const { firstName, lastName, email, password, country } = this.form.getRawValue();
      const first = firstName.trim().replace(/\s+/g, ' '), last = lastName.trim().replace(/\s+/g, ' ');
      await this.auth.register(`${first} ${last}`, email, password, { firstName: first, lastName: last, country: country || undefined });
      try {
        sessionStorage.removeItem(DRAFT);
      } catch {
        void 0;
      }
      this.platform.success();
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
