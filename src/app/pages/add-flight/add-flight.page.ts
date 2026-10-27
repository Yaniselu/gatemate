import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, NavController } from '@ionic/angular/standalone';
import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { TravelStore } from '../../core/services/travel.store';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { PlatformService } from '../../core/services/platform.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { BcbpError, parseBcbp } from '../../core/utils/bcbp';
import { cleanText } from '../../core/security/sanitize';

const IATA = /^[A-Z]{3}$/;
const CARRIER = /^[A-Z0-9]{2,3}$/;
const FLIGHT_NO = /^\d{1,4}[A-Z]?$/;
const SEAT = /^\d{1,3}[A-K]$/;
const PNR = /^[A-Z0-9]{5,8}$/;

@Component({
  selector: 'gm-add-flight',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, ReactiveFormsModule],
  templateUrl: './add-flight.page.html',
  styleUrl: './add-flight.page.scss',
})
export class AddFlightPage {
  private fb = inject(FormBuilder);
  private store = inject(TravelStore);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private platform = inject(PlatformService);
  private notifications = inject(NotificationsService);
  private nav = inject(NavController);

  readonly bars = [3, 1, 2, 4, 1, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 2, 4, 1, 3, 1, 1, 2, 4, 1, 2, 3, 1, 2, 1, 4, 2, 1, 3, 2, 1, 1, 4, 2];
  readonly mode = signal<'scan' | 'manual'>('scan');
  readonly scanning = signal(false);
  readonly saving = signal(false);
  readonly scanned = signal(false);
  readonly submitted = signal(false);

  readonly form = this.fb.nonNullable.group({
    carrier: ['', [Validators.required, Validators.pattern(CARRIER)]],
    flightNumber: ['', [Validators.required, Validators.pattern(FLIGHT_NO)]],
    date: [new Date(Date.now() + 86_400_000).toISOString().slice(0, 16), Validators.required],
    from: ['', [Validators.required, Validators.pattern(IATA)]],
    to: ['', [Validators.required, Validators.pattern(IATA)]],
    seat: ['', Validators.pattern(SEAT)],
    bookingRef: ['', Validators.pattern(PNR)],
  });

  bad(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || this.submitted());
  }

  /** Uppercase and strip anything that is not A–Z/0–9 as the user types. */
  normalize(name: keyof typeof this.form.controls, ev: Event) {
    const input = ev.target as HTMLInputElement;
    const v = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (v !== input.value) this.form.controls[name].setValue(v);
  }

  async scan() {
    if (!this.platform.isNative) {
      await this.toast.show('Camera scanning works in the iOS and Android app. Loaded a sample pass instead.');
      this.fill(sampleBcbp());
      return;
    }
    this.scanning.set(true);
    try {
      const { supported } = await BarcodeScanner.isSupported();
      if (!supported) throw new BcbpError('Scanning is not supported on this device.');
      const perm = await BarcodeScanner.requestPermissions();
      if (perm.camera !== 'granted' && perm.camera !== 'limited') throw new BcbpError('Allow camera access in Settings to scan your boarding pass.');
      const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.Pdf417, BarcodeFormat.Aztec, BarcodeFormat.QrCode, BarcodeFormat.DataMatrix] });
      const raw = barcodes[0]?.rawValue;
      if (raw) this.fill(raw);
    } catch (e) {
      await this.toast.show(e instanceof BcbpError ? e.message : 'Scan cancelled.', e instanceof BcbpError ? 'error' : 'info');
    } finally {
      this.scanning.set(false);
    }
  }

  private fill(raw: string) {
    try {
      const p = parseBcbp(raw);
      const date = new Date(p.flightDate);
      date.setUTCHours(9, 0);
      this.form.patchValue({
        carrier: p.carrier,
        flightNumber: p.flightNumber,
        date: date.toISOString().slice(0, 16),
        from: p.from,
        to: p.to,
        seat: p.seat,
        bookingRef: p.bookingRef,
      });
      this.scanned.set(true);
      this.mode.set('manual');
      this.platform.success();
    } catch (e) {
      void this.toast.show(e instanceof BcbpError ? e.message : 'Could not read this code.', 'error');
    }
  }

  async save() {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.platform.error();
      return;
    }
    const v = this.form.getRawValue();
    if (v.from === v.to) {
      await this.toast.show('Departure and arrival airports must differ.', 'error');
      return;
    }
    this.saving.set(true);
    try {
      const trip = await this.store.addFlight({
        carrier: v.carrier,
        flightNumber: v.flightNumber,
        date: new Date(v.date).toISOString(),
        from: v.from,
        to: v.to,
        seat: v.seat || undefined,
        bookingRef: v.bookingRef || undefined,
        passengerName: cleanText(this.auth.user()?.name ?? 'Traveller', 60),
      });
      void this.notifications.requestPermission().then(() => this.notifications.scheduleForFlight(trip.flights[0]));
      await this.toast.show('Flight added — we will alert you before boarding', 'success', 'airplane');
      await this.nav.navigateRoot(['/tabs/trips']);
      await this.nav.navigateForward(['/trip', trip.id]);
    } catch {
      await this.toast.show('Could not save this flight. Please try again.', 'error');
    } finally {
      this.saving.set(false);
    }
  }
}

/** Demo IATA BCBP payload for the web preview, dated three days from today. */
function sampleBcbp(): string {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const julian = Math.floor((Date.now() - start) / 86_400_000) + 3;
  return (
    'M1' +
    'MORGAN/ALEX'.padEnd(20) +
    'E' +
    'GT7Q2M'.padEnd(7) +
    'OTP' +
    'FCO' +
    'AE'.padEnd(3) +
    '0732'.padEnd(5) +
    String(julian).padStart(3, '0') +
    'Y' +
    '012A' +
    '00042' +
    '1' +
    '00'
  );
}
