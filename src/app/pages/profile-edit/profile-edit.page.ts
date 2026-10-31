import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AlertController, IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, NavController } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { PlatformService } from '../../core/services/platform.service';
import { PrefsService } from '../../core/services/prefs.service';
import { AirportDbService, AirportRecord } from '../../core/services/airport-db.service';
import { AirportPickerComponent } from '../../shared/components/airport-picker.component';
import { nameValidator } from '../../core/security/validators';
import { cleanText } from '../../core/security/sanitize';
import { compressAvatar } from '../../core/utils/image';
import { ProfilePatch, SeatPreference } from '../../core/models';
import { HasUnsavedChanges } from '../../core/guards/unsaved.guard';
import { AchievementsService } from '../../core/services/achievements.service';
import { t as tr, TranslatePipe } from '../../core/i18n/i18n.service';

const PHONE = /^\+?[1-9]\d{6,14}$/;
const LEGAL = /^[\p{L}][\p{L}\p{M}' -]{0,39}$/u;

@Component({
  selector: 'gm-profile-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, ReactiveFormsModule, AirportPickerComponent, RouterLink],
  templateUrl: './profile-edit.page.html',
  styleUrl: './profile-edit.page.scss',
})
export class ProfileEditPage implements HasUnsavedChanges {
  protected auth = inject(AuthService);
  private prefs = inject(PrefsService);
  private toast = inject(ToastService);
  private platform = inject(PlatformService);
  private alerts = inject(AlertController);
  private nav = inject(NavController);
  private achievements = inject(AchievementsService);

  private user = this.auth.user()!;
  readonly nameLocked = !!(this.user.identityVerified || (this.user.legalFirstName && this.user.legalLastName));
  private db = inject(AirportDbService);
  readonly pickingHome = signal(false);
  private dbReady = signal(false);
  readonly homeRecord = computed(() => (this.dbReady() ? this.db.get(this.value().homeAirport ?? '') : undefined));

  setHome(a: AirportRecord) {
    this.pickingHome.set(false);
    this.form.controls.homeAirport.setValue(a.iata);
    this.form.controls.homeAirport.markAsDirty();
  }
  readonly seats: { id: SeatPreference; label: string; icon: string }[] = [
    { id: 'window', label: 'Window', icon: 'sunny-outline' },
    { id: 'aisle', label: 'Aisle', icon: 'walk-outline' },
    { id: 'no-preference', label: 'Any', icon: 'swap-horizontal' },
  ];

  readonly form = inject(FormBuilder).nonNullable.group({
    name: [this.user.name, [Validators.required, Validators.maxLength(60), nameValidator]],
    legalFirstName: [this.user.legalFirstName ?? '', [Validators.required, Validators.pattern(LEGAL)]],
    legalLastName: [this.user.legalLastName ?? '', [Validators.required, Validators.pattern(LEGAL)]],
    phone: [this.user.phone ?? '', Validators.pattern(PHONE)],
    homeAirport: [this.user.homeAirport ?? 'OTP'],
    seatPreference: [this.user.seatPreference ?? ('no-preference' as SeatPreference)],
    bio: [this.user.bio ?? '', Validators.maxLength(160)],
  });

  readonly avatar = signal<string | undefined>(this.user.avatarUrl);
  readonly avatarBusy = signal(false);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly submitted = signal(false);
  private value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  readonly bioLength = computed(() => (this.value().bio ?? '').length);

  readonly patch = computed<ProfilePatch>(() => {
    const v = { ...this.form.getRawValue(), ...this.value() };
    const out: Record<string, unknown> = {};
    const cmp = (k: keyof ProfilePatch, val: unknown) => {
      if ((this.user[k] ?? '') !== (val ?? '')) out[k] = val;
    };
    (['name', 'legalFirstName', 'legalLastName', 'phone', 'homeAirport', 'seatPreference', 'bio'] as const).forEach((k) => cmp(k, typeof v[k] === 'string' ? (v[k] as string).trim() : v[k]));
    if (this.avatar() !== this.user.avatarUrl) out['avatarUrl'] = this.avatar() ?? '';
    return out as ProfilePatch;
  });
  readonly dirty = computed(() => Object.keys(this.patch()).length > 0);
  readonly initials = computed(() => (this.value().name ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase());

  constructor() {
    void this.db.load().then(() => this.dbReady.set(true));
  }

  bad(name: keyof typeof this.form.controls) {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || this.submitted());
  }

  pickPhoto() {
    document.getElementById('avatar-file')?.click();
  }

  async onPhoto(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.avatarBusy.set(true);
    try {
      this.avatar.set(await compressAvatar(file));
      this.platform.success();
    } catch (e) {
      await this.toast.show(e instanceof Error ? e.message : 'Could not use this photo.', 'error');
    } finally {
      this.avatarBusy.set(false);
    }
  }

  removePhoto() {
    this.platform.tap();
    this.avatar.set(undefined);
  }

  seatIndex(): number {
    return this.seats.findIndex((s) => s.id === this.form.controls.seatPreference.value);
  }

  setSeat(s: SeatPreference) {
    this.platform.selection();
    this.form.controls.seatPreference.setValue(s);
  }

  async save() {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.platform.error();
      return;
    }
    const patch = { ...this.patch() };
    if (patch.bio !== undefined) patch.bio = cleanText(patch.bio, 160);
    this.saving.set(true);
    try {
      this.user = await this.auth.updateProfile(patch);
      if (patch.homeAirport) await this.prefs.setHomeAirport(patch.homeAirport);
      this.form.markAsPristine();
      this.form.setValue(this.form.getRawValue());
      this.saved.set(true);
      if (this.user.legalFirstName && this.user.legalLastName && this.user.avatarUrl && this.user.homeAirport) void this.achievements.track('profile_complete');
      this.platform.success();
      setTimeout(() => this.saved.set(false), 1800);
    } catch {
      await this.toast.show('Could not save your profile. Please try again.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async confirmLeave(): Promise<boolean> {
    if (!this.dirty() || this.saving()) return true;
    const alert = await this.alerts.create({
      header: tr('Discard changes?'),
      message: tr('You have unsaved changes to your profile.'),
      buttons: [
        { text: tr('Keep editing'), role: 'cancel' },
        { text: tr('Discard'), role: 'destructive' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'destructive';
  }

  close() {
    void this.nav.back();
  }
}
