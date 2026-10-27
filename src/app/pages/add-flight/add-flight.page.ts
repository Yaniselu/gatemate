import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, NavController } from '@ionic/angular/standalone';
import { TravelStore } from '../../core/services/travel.store';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { PlatformService } from '../../core/services/platform.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { PassReaderService } from '../../core/services/pass-reader.service';
import { ApiError, GatemateApi } from '../../core/services/api';
import { AIRLINES, AirlineOption } from '../../core/data/airlines';
import { BcbpError, BoardingPassData, parseBcbp } from '../../core/utils/bcbp';
import { matchPassengerName } from '../../core/utils/name-match';
import { cleanText } from '../../core/security/sanitize';
import { Trip } from '../../core/models';
import { ConfettiService } from '../../shared/components/confetti.service';
import { ReviewService } from '../../core/services/review.service';
import { AchievementsService } from '../../core/services/achievements.service';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { PressableDirective } from '../../shared/directives/pressable.directive';
import { SheenDirective } from '../../shared/directives/sheen.directive';

type Step = 'choose' | 'airline' | 'email' | 'manual' | 'verifying' | 'done' | 'failed';
interface Check {
  label: string;
  state: 'wait' | 'run' | 'ok' | 'bad';
}

const IATA = /^[A-Z]{3}$/;
const CARRIER = /^[A-Z0-9]{2,3}$/;
const FLIGHT_NO = /^\d{1,4}[A-Z]?$/;
const SEAT = /^\d{1,3}[A-K]$/;
const PNR = /^[A-Z0-9]{6}$/;

@Component({
  selector: 'gm-add-flight',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonIcon, ReactiveFormsModule, RouterLink, RevealDirective, PressableDirective, SheenDirective],
  templateUrl: './add-flight.page.html',
  styleUrl: './add-flight.page.scss',
})
export class AddFlightPage {
  private fb = inject(FormBuilder);
  private api = inject(GatemateApi);
  private store = inject(TravelStore);
  protected auth = inject(AuthService);
  private toast = inject(ToastService);
  private platform = inject(PlatformService);
  private notifications = inject(NotificationsService);
  private reader = inject(PassReaderService);
  private confetti = inject(ConfettiService);
  private review = inject(ReviewService);
  private achievements = inject(AchievementsService);
  private nav = inject(NavController);

  readonly step = signal<Step>('choose');
  readonly busy = signal(false);
  readonly airlines = AIRLINES;
  readonly airline = signal<AirlineOption | null>(null);
  readonly airlineQuery = signal('');
  readonly filteredAirlines = computed(() => {
    const q = this.airlineQuery().trim().toLowerCase();
    return q ? AIRLINES.filter((a) => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q)) : AIRLINES;
  });
  readonly importEmail = signal<string | null>(null);
  readonly checks = signal<Check[]>([]);
  readonly result = signal<Trip | null>(null);
  readonly failure = signal<{ title: string; body: string; code?: string } | null>(null);
  readonly hasLegalName = computed(() => !!(this.auth.user()?.legalFirstName && this.auth.user()?.legalLastName));
  readonly legalName = computed(() => `${this.auth.user()?.legalFirstName ?? ''} ${this.auth.user()?.legalLastName ?? ''}`.trim());

  readonly bookingForm = this.fb.nonNullable.group({
    bookingRef: ['', [Validators.required, Validators.pattern(PNR)]],
    lastName: ['', [Validators.required, Validators.maxLength(40)]],
  });

  readonly manualForm = this.fb.nonNullable.group({
    carrier: ['', [Validators.required, Validators.pattern(CARRIER)]],
    flightNumber: ['', [Validators.required, Validators.pattern(FLIGHT_NO)]],
    date: [new Date(Date.now() + 86_400_000).toISOString().slice(0, 16), Validators.required],
    from: ['', [Validators.required, Validators.pattern(IATA)]],
    to: ['', [Validators.required, Validators.pattern(IATA)]],
    seat: ['', Validators.pattern(SEAT)],
  });
  readonly submitted = signal(false);

  readonly methods: { id: string; icon: string; title: string; body: string; badge?: string }[] = [
    { id: 'airline', icon: 'airplane-outline', title: 'Import from airline', body: 'Booking reference + last name. Bags and seats included.', badge: 'Best' },
    { id: 'scan', icon: 'scan-outline', title: 'Scan boarding pass', body: 'Paper pass or another phone’s screen.' },
    { id: 'upload', icon: 'image-outline', title: 'Upload a screenshot', body: 'From the Wizz Air, Ryanair or any airline app.' },
    { id: 'email', icon: 'mail-outline', title: 'Forward the confirmation email', body: 'We read it automatically and verify the sender.' },
  ];

  // ----- Navigation -----
  choose(id: string) {
    this.platform.tap();
    if (id === 'scan') void this.scan();
    else if (id === 'upload') document.getElementById('pass-file')?.click();
    else if (id === 'email') void this.openEmail();
    else this.step.set(id as Step);
  }

  back() {
    if (this.step() === 'choose') void this.nav.back();
    else {
      this.step.set('choose');
      this.failure.set(null);
    }
  }

  pickAirline(a: AirlineOption) {
    this.platform.selection();
    this.airline.set(a);
    if (!this.bookingForm.controls.lastName.value) this.bookingForm.controls.lastName.setValue(this.auth.user()?.legalLastName ?? '');
  }

  normalize(form: 'booking' | 'manual', name: string, ev: Event) {
    const input = ev.target as HTMLInputElement;
    const v = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const group = form === 'booking' ? this.bookingForm : this.manualForm;
    const ctrl = (group.controls as Record<string, { setValue(v: string): void }>)[name];
    if (v !== input.value) ctrl.setValue(v);
  }

  // ----- Sources -----
  async scan() {
    if (!this.platform.isNative) {
      await this.toast.show('Camera scanning works in the app. Using a sample boarding pass in your name.');
      await this.verifyPass(this.sample());
      return;
    }
    try {
      const raw = await this.reader.fromCamera();
      if (raw) await this.verifyPass(raw);
    } catch (e) {
      await this.toast.show(e instanceof BcbpError ? e.message : 'Scan cancelled.', e instanceof BcbpError ? 'error' : 'info');
    }
  }

  async onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      await this.verifyPass(await this.reader.fromImage(file));
    } catch (e) {
      if (e instanceof BcbpError && !this.platform.isNative) {
        await this.toast.show(e.message);
        await this.verifyPass(this.sample());
      } else {
        await this.toast.show(e instanceof Error ? e.message : 'Could not read that image.', 'error');
      }
    }
  }

  async openEmail() {
    this.step.set('email');
    if (!this.importEmail()) this.importEmail.set(await this.api.getImportEmail());
  }

  async copyEmail() {
    const v = this.importEmail();
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
      await this.toast.show('Address copied', 'success');
    } catch {
      await this.toast.show(v);
    }
  }

  // ----- Verification flows -----
  private async verifyPass(raw: string) {
    let pass: BoardingPassData;
    try {
      pass = parseBcbp(raw);
    } catch (e) {
      await this.toast.show(e instanceof BcbpError ? e.message : 'Could not read this code.', 'error');
      return;
    }
    const user = this.auth.user();
    const match = matchPassengerName(pass.firstName, pass.lastName, user?.legalFirstName ?? '', user?.legalLastName ?? '');
    await this.runChecks(
      ['Reading IATA boarding pass', `Matching “${pass.passengerName}” to your legal name`, 'Checking it isn’t linked to another account', 'Securing it on this device'],
      async (advance) => {
        await advance(true);
        await advance(match.ok);
        if (!match.ok) {
          throw new ApiError('This boarding pass is in another passenger’s name.', 403, 'name_mismatch');
        }
        const trip = await this.api.claimFlight({ method: 'pass', barcode: pass.raw });
        await advance(true);
        await advance(true);
        return trip;
      },
    );
  }

  async lookupBooking() {
    this.submitted.set(true);
    const a = this.airline();
    if (!a || this.bookingForm.invalid) {
      this.platform.error();
      return;
    }
    const { bookingRef, lastName } = this.bookingForm.getRawValue();
    const req = { airline: a.code, bookingRef, lastName: cleanText(lastName, 40) };
    await this.runChecks(
      [`Contacting ${a.name}`, 'Confirming booking reference and last name', 'Matching passenger to your legal name', 'Importing flights, seats and bags'],
      async (advance) => {
        await advance(true);
        const found = await this.api.lookupBooking(req);
        await advance(true);
        const m = matchPassengerName(found.passengerFirstName, found.passengerLastName, this.auth.user()?.legalFirstName ?? '', this.auth.user()?.legalLastName ?? '');
        await advance(m.ok);
        if (!m.ok) throw new ApiError('This booking is in another passenger’s name.', 403, 'name_mismatch');
        const trip = await this.api.claimFlight({ method: 'booking', ...req, flightIds: found.flights.map((f) => f.id) });
        await advance(true);
        return trip;
      },
    );
  }

  /** Animates each check, runs the work, then shows success or a clear failure. */
  private async runChecks(labels: string[], work: (advance: (ok: boolean) => Promise<void>) => Promise<Trip>) {
    this.failure.set(null);
    this.checks.set(labels.map((label, i) => ({ label, state: i === 0 ? 'run' : 'wait' })));
    this.step.set('verifying');
    let i = 0;
    const advance = async (ok: boolean) => {
      await wait(550);
      this.checks.update((cs) => cs.map((c, j) => (j === i ? { ...c, state: ok ? 'ok' : 'bad' } : j === i + 1 && ok ? { ...c, state: 'run' } : c)));
      ok ? this.platform.selection() : this.platform.error();
      i++;
    };
    try {
      const trip = await work(advance);
      this.store.trips.update((list) => [...list, trip]);
      this.result.set(trip);
      await wait(350);
      this.step.set('done');
      this.platform.success();
      this.confetti.burst(0.5, 0.3, 120);
      void this.review.positiveMoment(2500);
      void this.achievements.track('booking_verified');
      void this.notifications.requestPermission().then(() => this.notifications.scheduleForFlight(trip.flights[0]));
    } catch (e) {
      this.checks.update((cs) => cs.map((c) => (c.state === 'run' ? { ...c, state: 'bad' } : c)));
      const err = e instanceof ApiError ? e : null;
      this.failure.set(
        err?.code === 'name_mismatch'
          ? { title: 'This ticket isn’t in your name', body: `Gatemate only adds tickets that belong to you (${this.legalName() || 'your legal name'}). If it’s a friend’s, ask them to add it and invite you to the trip.`, code: err.code }
          : err?.code === 'legal_name_missing'
            ? { title: 'Add your legal name first', body: 'We compare it with the name on the ticket to make sure it’s yours.', code: err.code }
            : { title: 'We couldn’t verify this booking', body: err?.message ?? 'Please check the details and try again.', code: err?.code },
      );
      await wait(400);
      this.step.set('failed');
    }
  }

  async saveManual() {
    this.submitted.set(true);
    if (this.manualForm.invalid) {
      this.platform.error();
      return;
    }
    const v = this.manualForm.getRawValue();
    if (v.from === v.to) {
      await this.toast.show('Departure and arrival airports must differ.', 'error');
      return;
    }
    this.busy.set(true);
    try {
      const trip = await this.store.addFlight({
        carrier: v.carrier,
        flightNumber: v.flightNumber,
        date: new Date(v.date).toISOString(),
        from: v.from,
        to: v.to,
        seat: v.seat || undefined,
        passengerName: cleanText(this.legalName() || this.auth.user()?.name || 'Traveller', 60),
      });
      await this.toast.show('Flight added as unverified — import the booking later to verify it', 'success', 'airplane');
      await this.openTrip(trip);
    } catch {
      await this.toast.show('Could not save this flight. Please try again.', 'error');
    } finally {
      this.busy.set(false);
    }
  }

  async openTrip(trip: Trip | null = this.result()) {
    if (!trip) return;
    await this.nav.navigateRoot(['/tabs/trips']);
    await this.nav.navigateForward(['/trip', trip.id]);
  }

  /** Demo IATA BCBP payload in the signed-in user's legal name, three days from today. */
  private sample(): string {
    const u = this.auth.user();
    const last = (u?.legalLastName || 'MORGAN').toUpperCase().normalize('NFD').replace(/[^A-Z ]/g, '');
    const first = (u?.legalFirstName || 'ALEX').toUpperCase().normalize('NFD').replace(/[^A-Z ]/g, '');
    const now = new Date();
    const julian = Math.floor((Date.now() - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86_400_000) + 3;
    return 'M1' + `${last}/${first}`.slice(0, 20).padEnd(20) + 'E' + 'GT7Q2M'.padEnd(7) + 'OTP' + 'FCO' + 'W6 ' + '3121 ' + String(julian).padStart(3, '0') + 'Y' + '012A' + '00042' + '1' + '00';
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
