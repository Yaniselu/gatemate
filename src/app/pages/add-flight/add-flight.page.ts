import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, NavController } from '@ionic/angular/standalone';
import { TravelStore } from '../../core/services/travel.store';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { PlatformService } from '../../core/services/platform.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { environment } from '../../../environments/environment';
import { ProService } from '../../core/services/pro.service';
import { PassReaderService } from '../../core/services/pass-reader.service';
import { ApiError, EmailPreview, GatemateApi } from '../../core/services/api';
import { ClockPipe, ShortDatePipe } from '../../shared/pipes/time.pipes';
import { AIRLINES, AirlineOption } from '../../core/data/airlines';
import { BcbpError, BoardingPassData, parseBcbp } from '../../core/utils/bcbp';
import { matchPassengerName } from '../../core/utils/name-match';
import { cleanText } from '../../core/security/sanitize';
import { Companion, Relation, Trip } from '../../core/models';
import { RELATIONS } from '../family/family.page';
import { firstOnTicket, nameQuality } from '../../core/utils/name-match';
import { ConfettiService } from '../../shared/components/confetti.service';
import { ReviewService } from '../../core/services/review.service';
import { AchievementsService } from '../../core/services/achievements.service';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { PressableDirective } from '../../shared/directives/pressable.directive';
import { SheenDirective } from '../../shared/directives/sheen.directive';
import { t as tr, TranslatePipe } from '../../core/i18n/i18n.service';

type Step = 'choose' | 'airline' | 'email' | 'manual' | 'verifying' | 'done' | 'failed' | 'whose';
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
  imports: [TranslatePipe, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonIcon, ReactiveFormsModule, RouterLink, RevealDirective, PressableDirective, SheenDirective, ClockPipe, ShortDatePipe],
  templateUrl: './add-flight.page.html',
  styleUrl: './add-flight.page.scss',
})
export class AddFlightPage {
  private fb = inject(FormBuilder);
  private api = inject(GatemateApi);
  readonly companions = signal<Companion[]>([]);
  readonly flyingWith = signal<Set<string>>(new Set());
  private loadFamily = this.api.getCompanions().then((c) => this.companions.set(c)).catch(() => {});
  readonly addingPerson = signal(false);
  readonly person = signal<{ first: string; last: string; relation: Relation }>({ first: '', last: '', relation: 'child' });

  setPerson(patch: Partial<{ first: string; last: string; relation: Relation }>) {
    this.person.update((w) => ({ ...w, ...patch }));
  }

  async addPerson() {
    const w = this.person();
    if (!w.first.trim() || !w.last.trim()) return;
    try {
      const c = await this.api.addCompanion({ firstName: w.first.trim(), lastName: w.last.trim(), relation: w.relation });
      this.companions.update((l) => [...l, c]);
      this.person.set({ first: '', last: w.last.trim(), relation: w.relation });
      this.addingPerson.set(false);
      this.platform.impact();
      await this.toast.show(tr('{name} added. Now scan their boarding pass or add them to a flight.', { name: c.firstName }), 'success');
    } catch (e) {
      await this.toast.show(e instanceof Error ? e.message : 'Couldn’t add them.', 'error');
    }
  }

  toggleCompanion(id: string) {
    this.platform.selection();
    this.flyingWith.update((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  private store = inject(TravelStore);
  protected auth = inject(AuthService);
  private toast = inject(ToastService);
  private platform = inject(PlatformService);
  private notifications = inject(NotificationsService);
  private reader = inject(PassReaderService);
  protected pro = inject(ProService);
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
  readonly forwardState = signal<'loading' | 'ready' | 'off'>('loading');
  readonly emailText = signal('');
  readonly emailPreview = signal<EmailPreview | null>(null);
  readonly emailBusy = signal(false);
  readonly emailError = signal('');
  readonly checks = signal<Check[]>([]);
  readonly result = signal<Trip | null>(null);
  readonly passFor = signal<string | null>(null);
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
    { id: 'email', icon: 'mail-outline', title: 'From the confirmation e-mail', body: 'Paste it or forward it. Every flight in the booking, with times.', badge: 'Best' },
    { id: 'scan', icon: 'scan-outline', title: 'Scan boarding pass', body: 'Paper pass or another phone’s screen.' },
    { id: 'upload', icon: 'image-outline', title: 'Upload a screenshot', body: 'From the Wizz Air, Ryanair or any airline app.' },
    ...(environment.useMocks ? [{ id: 'airline', icon: 'airplane-outline', title: 'Import from airline', body: 'Booking reference + last name. Bags and seats included.' }] : []),
  ];

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

  shown(f: Trip['flights'][number]) {
    const who = this.passFor();
    const p = who ? f.passengers?.find((x) => x.name.split(' ')[0].toLowerCase() === who.toLowerCase()) : undefined;
    return p ? { name: p.name, seat: p.seat } : { name: f.passengerName, seat: f.seat };
  }

  async scanNext() {
    this.result.set(null);
    this.step.set('choose');
    await this.scan();
  }

  async scan() {
    if (!this.platform.isNative) {
      if (environment.useMocks) {
        await this.toast.show('Camera scanning works in the app. Using a sample boarding pass in your name.');
        await this.verifyPass(this.sample());
      } else {
        await this.toast.show('Camera scanning works in the Gatemate app. Here, upload a screenshot of your boarding pass.');
      }
      return;
    }
    let raw: string | null;
    try {
      raw = await this.reader.fromCamera();
    } catch (e) {
      await this.toast.show(e instanceof BcbpError ? e.message : 'The camera scanner could not start.', 'error');
      return;
    }
    if (raw) await this.verifyPass(raw);
  }

  async onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    let raw: string;
    try {
      raw = await this.reader.fromImage(file);
    } catch (e) {
      if (environment.useMocks && !this.platform.isNative) {
        await this.toast.show(e instanceof Error ? e.message : 'Could not read that image.');
        await this.verifyPass(this.sample());
      } else {
        await this.toast.show(e instanceof Error ? e.message : 'Could not read that image.', 'error');
      }
      return;
    }
    await this.verifyPass(raw);
  }

  async openEmail() {
    this.step.set('email');
    this.emailError.set('');
    if (this.importEmail()) return;
    this.forwardState.set('loading');
    try {
      this.importEmail.set(await this.api.getImportEmail());
      this.forwardState.set('ready');
    } catch {
      this.forwardState.set('off');
    }
  }

  async pasteEmail() {
    try {
      const t = await navigator.clipboard.readText();
      if (t) this.setEmailText(t);
      else await this.toast.show('Nothing to paste. Copy the e-mail text first.');
    } catch {
      await this.toast.show('Tap and hold in the box, then choose Paste.');
    }
  }

  setEmailText(t: string) {
    this.emailText.set(t.slice(0, 200_000));
    this.emailPreview.set(null);
    this.emailError.set('');
  }

  async readEmail() {
    const text = this.emailText().trim();
    if (text.length < 20) {
      this.emailError.set('Paste the whole confirmation e-mail: flight number, airports and date.');
      this.platform.error();
      return;
    }
    this.emailBusy.set(true);
    this.emailError.set('');
    try {
      this.emailPreview.set(await this.api.previewEmail(text));
      this.platform.success();
    } catch (e) {
      this.platform.error();
      this.emailError.set(e instanceof ApiError ? e.message : 'We couldn’t read this e-mail. Please try again.');
    } finally {
      this.emailBusy.set(false);
    }
  }

  async addFromEmail() {
    const p = this.emailPreview();
    if (!p) return;
    const n = p.flights.length;
    await this.runChecks(
      [`Reading ${n} flight${n === 1 ? '' : 's'} from your e-mail`, p.nameFound ? `Matching “${this.legalName()}” on the booking` : 'Your name isn’t in the e-mail: adding as unverified', 'Checking it isn’t linked to another account', 'Creating your trip'],
      async (advance) => {
        await advance(true);
        await advance(true);
        const trip = await this.api.importEmail(this.emailText());
        await advance(true);
        await advance(true);
        this.emailText.set('');
        this.emailPreview.set(null);
        return trip;
      },
    );
  }

  async copyEmail() {
    const v = this.importEmail();
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
      await this.toast.show('Address copied', 'success');
    } catch (e) {
      await this.toast.show(v);
    }
  }

  private async verifyPass(raw: string) {
    let pass: BoardingPassData;
    try {
      pass = parseBcbp(raw);
    } catch (e) {
      await this.toast.show(e instanceof BcbpError ? e.message : 'Could not read this code.', 'error');
      return;
    }
    const user = this.auth.user();
    await this.loadFamily;
    const selfQ = nameQuality(pass.firstName, pass.lastName, user?.legalFirstName, user?.legalLastName);
    let best: Companion | undefined;
    let bestQ = 0;
    for (const c of this.companions()) {
      const q = nameQuality(pass.firstName, pass.lastName, c.firstName, c.lastName);
      if (q > bestQ) {
        bestQ = q;
        best = c;
      }
    }
    if (best && bestQ > selfQ) return this.claimPass(pass, best);
    if (selfQ >= 3) return this.claimPass(pass);
    const words = (s: string) => s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());
    this.pending.set({ pass, selfPossible: selfQ > 0 });
    this.who.set({ first: words(firstOnTicket(pass.firstName).toLowerCase()), last: words(pass.lastName.toLowerCase()), relation: 'child' });
    this.step.set('whose');
  }

  readonly pending = signal<{ pass: BoardingPassData; selfPossible: boolean } | null>(null);
  readonly who = signal<{ first: string; last: string; relation: Relation }>({ first: '', last: '', relation: 'child' });
  readonly relations = RELATIONS;

  setWho(patch: Partial<{ first: string; last: string; relation: Relation }>) {
    this.who.update((w) => ({ ...w, ...patch }));
  }

  async mine() {
    const p = this.pending();
    if (p) await this.claimPass(p.pass);
  }

  async saveAndClaim() {
    const p = this.pending(), w = this.who();
    if (!p || !w.first.trim() || !w.last.trim()) return;
    try {
      const c = await this.api.addCompanion({ firstName: w.first.trim(), lastName: w.last.trim(), relation: w.relation });
      this.companions.update((l) => [...l, c]);
      await this.claimPass(p.pass, c);
    } catch (e) {
      await this.toast.show(e instanceof Error ? e.message : 'Couldn’t add them.', 'error');
    }
  }

  private async claimPass(pass: BoardingPassData, relative?: Companion) {
    this.pending.set(null);
    this.passFor.set(relative ? relative.firstName : null);
    await this.runChecks(
      ['Reading IATA boarding pass', relative ? tr('Matching “{name}” to {who} from your family', { name: pass.passengerName, who: relative.firstName }) : tr('Matching “{name}” to you or your family', { name: pass.passengerName }), 'Checking it isn’t linked to another account', 'Securing it on this device'],
      async (advance) => {
        await advance(true);
        await advance(true);
        const trip = await this.api.claimFlight({ method: 'pass', barcode: pass.raw, companionId: relative?.id });
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
      this.store.trips.update((list) => [...list.filter((x) => x.id !== trip.id), trip]);
      this.result.set(trip);
      await wait(350);
      this.step.set('done');
      this.platform.success();
      this.confetti.burst(0.5, 0.3, 120);
      void this.review.positiveMoment(2500);
      void this.achievements.track('booking_verified');
      void this.notifications.requestPermission();
    } catch (e) {
      this.checks.update((cs) => cs.map((c) => (c.state === 'run' ? { ...c, state: 'bad' } : c)));
      const err = e instanceof ApiError ? e : null;
      this.failure.set(
        err?.code === 'name_mismatch'
          ? { title: 'This ticket isn’t in your name or your family’s', body: tr('Gatemate adds tickets in your name ({name}) or in the name of someone in your Family. Add them in Profile → Family with the name exactly as on the ticket, then scan it again.', { name: this.legalName() || tr('your legal name') }), code: err.code }
          : err?.code === 'legal_name_missing'
            ? { title: 'Add your legal name first', body: 'We compare it with the name on the ticket to make sure it’s yours.', code: err.code }
            : err?.code === 'pro_required'
              ? { title: 'You’ve reached the free limit', body: 'Free accounts keep up to 5 upcoming tickets, your family’s included. Upgrade to Gatemate Pro for unlimited tickets, or wait until a trip is over.', code: err.code }
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
        airlineName: AIRLINES.find((a) => a.code === v.carrier)?.name,
        flightNumber: v.flightNumber,
        date: v.date.slice(0, 16),
        from: v.from,
        to: v.to,
        seat: v.seat || undefined,
        passengerName: cleanText(this.legalName() || this.auth.user()?.name || 'Traveller', 60),
        passengers: [...this.flyingWith()].map((companionId) => ({ companionId })),
      });
      await this.toast.show('Flight added as unverified — import the booking later to verify it', 'success', 'airplane');
      await this.openTrip(trip);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'pro_required') {
        this.pro.open('trips');
        return;
      }
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
