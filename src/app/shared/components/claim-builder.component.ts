import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Flight } from '../../core/models';
import { TravelStore } from '../../core/services/travel.store';
import { AirportDbService } from '../../core/services/airport-db.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';

const EU = new Set(['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT',
  'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'CH']);

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371, r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

@Component({
  selector: 'gm-claim-builder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, TranslatePipe, FormsModule],
  template: `
    <section class="card">
      <header>
        <span class="ic"><ion-icon name="document-text-outline" /></span>
        <div><b>{{ 'Claim it yourself, for free' | t }}</b><small>{{ 'Claim companies keep 25–35 % of your money. Here you keep all of it.' | t }}</small></div>
      </header>

      @if (flights().length) {
        <label class="field">
          <span class="gm-label">{{ 'Flight' | t }}</span>
          <select [ngModel]="flightId()" (ngModelChange)="flightId.set($event)">
            @for (f of flights(); track f.id) { <option [value]="f.id">{{ f.number }} · {{ f.from.code }} → {{ f.to.code }} · {{ day(f) }}</option> }
          </select>
        </label>
      } @else {
        <p class="muted">{{ 'Add a flight first, then come back to claim.' | t }}</p>
      }

      <div class="what">
        <button [class.on]="!cancelled()" (click)="cancelled.set(false)">{{ 'Delayed' | t }}</button>
        <button [class.on]="cancelled()" (click)="cancelled.set(true)">{{ 'Cancelled' | t }}</button>
      </div>
      @if (!cancelled()) {
        <label class="field">
          <span class="gm-label">{{ 'Delay at arrival: {h} h' | t: { h: delay() } }}</span>
          <input type="range" min="0" max="10" step="0.5" [ngModel]="delay()" (ngModelChange)="delay.set(+$event)" />
        </label>
      }

      @if (verdict(); as v) {
        <div class="verdict" [attr.data-ok]="v.ok">
          <ion-icon [name]="v.ok ? 'checkmark-circle' : 'information-circle-outline'" />
          <div>
            @if (v.ok) { <b>{{ 'You can claim €{eur} per passenger' | t: { eur: v.amount } }}</b> }
            @else { <b>{{ 'Probably not eligible' | t }}</b> }
            <small>{{ v.why | t: v.args }}</small>
          </div>
        </div>
      }

      @if (verdict()?.ok) {
        <label class="field">
          <span class="gm-label">{{ 'Your name, as on the booking' | t }}</span>
          <input type="text" [ngModel]="name()" (ngModelChange)="name.set($event)" autocomplete="name" />
        </label>
        <label class="field">
          <span class="gm-label">{{ 'What the airline said caused it (optional)' | t }}</span>
          <input type="text" [ngModel]="reason()" (ngModelChange)="reason.set($event)" [placeholder]="'e.g. technical problem' | t" />
        </label>
        <pre class="letter selectable">{{ letter() }}</pre>
        <div class="actions">
          <button class="gm-btn small" (click)="copy()"><ion-icon [name]="copied() ? 'checkmark' : 'copy-outline'" /> {{ (copied() ? 'Copied' : 'Copy') | t }}</button>
          <button class="gm-btn small" (click)="share()"><ion-icon name="share-outline" /> {{ 'Share' | t }}</button>
          <a class="gm-btn small" [href]="mailto()"><ion-icon name="mail-outline" /> {{ 'E-mail' | t }}</a>
        </div>
        <ol class="next">
          <li>{{ 'Send it through the airline’s claim form or customer-relations e-mail, with your boarding pass and booking confirmation.' | t }}</li>
          <li>{{ 'Airlines usually answer within 2–6 weeks. If they refuse or don’t answer, escalate to the national enforcement body (in Romania: ANPC).' | t }}</li>
          <li>{{ 'Extraordinary circumstances (bad weather, air-traffic control strikes, security) can rule out compensation, but not the right to care.' | t }}</li>
        </ol>
      }
    </section>
  `,
  styles: `
    :host { display: block; margin-top: 18px; }
    .card { padding: 16px; border-radius: 24px; }
    header { display: flex; gap: 10px; align-items: center; margin-bottom: 14px; }
    header b { display: block; font-size: 16px; font-weight: 800; }
    header small { display: block; font-size: 12.5px; color: var(--gm-ink-2); line-height: 1.35; }
    .ic { flex: none; width: 36px; height: 36px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 19px; color: #16a34a; background: rgba(22,163,74,.12); }
    .field { display: block; margin-top: 10px; }
    .field select, .field input[type=text] { width: 100%; height: 44px; margin-top: 6px; padding: 0 12px; border-radius: 12px; border: 1px solid var(--gm-card-border); background: var(--gm-surface); color: var(--gm-ink); font-size: 15px; }
    .field input[type=range] { width: 100%; margin-top: 8px; accent-color: #0fb5c3; }
    .what { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 12px; }
    .what button { height: 40px; border-radius: 12px; font-weight: 700; color: var(--gm-ink-2); background: var(--gm-surface); }
    .what button.on { color: #fff; background: var(--gm-solid); }
    .verdict { display: flex; gap: 10px; margin-top: 14px; padding: 12px 14px; border-radius: 16px; color: #92400e; background: rgba(245,158,11,.12); }
    .verdict[data-ok='true'] { color: #166534; background: rgba(22,163,74,.12); }
    .verdict ion-icon { flex: none; font-size: 24px; }
    .verdict b { display: block; font-size: 15.5px; }
    .verdict small { display: block; margin-top: 2px; font-size: 12.5px; line-height: 1.4; }
    .letter { margin: 14px 0 0; padding: 14px; border-radius: 14px; white-space: pre-wrap; font: 12.5px/1.5 ui-monospace, Menlo, monospace; color: var(--gm-ink); background: var(--gm-surface); max-height: 300px; overflow: auto; }
    .actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 10px; }
    .actions .gm-btn { height: 42px; padding: 0 8px; font-size: 13px; gap: 5px; white-space: nowrap; text-decoration: none; }
    .next { margin: 14px 0 0; padding-left: 18px; font-size: 13px; line-height: 1.45; color: var(--gm-ink-2); }
    .next li { margin: 4px 0; }
    .muted { color: var(--gm-ink-3); font-size: 13.5px; }
  `,
})
export class ClaimBuilderComponent implements OnInit {
  private store = inject(TravelStore);
  private db = inject(AirportDbService);

  readonly flights = computed(() =>
    this.store.trips().flatMap((t) => t.flights).sort((a, b) => +new Date(b.departure) - +new Date(a.departure)),
  );
  readonly flightId = signal<string | null>(null);
  readonly flight = computed<Flight | null>(() => this.flights().find((f) => f.id === this.flightId()) ?? this.flights()[0] ?? null);
  readonly cancelled = signal(false);
  readonly delay = signal(3.5);
  readonly name = signal('');
  readonly reason = signal('');
  readonly copied = signal(false);

  readonly verdict = computed(() => {
    this.db.ready();
    const f = this.flight();
    if (!f) return null;
    const a = this.db.get(f.from.code), b = this.db.get(f.to.code);
    const fromEU = a ? EU.has(a.country) : false, toEU = b ? EU.has(b.country) : false;
    const dist = a && b ? km(a, b) : f.distanceKm;
    const intraEU = fromEU && toEU;
    const amount = dist <= 1500 ? 250 : dist <= 3500 || intraEU ? 400 : 600;
    if (!fromEU && !toEU) return { ok: false, amount, why: 'EU261 covers flights departing from the EU, or arriving in it on a European airline.', args: {} };
    if (!this.cancelled() && this.delay() < 3) return { ok: false, amount, why: 'Compensation starts at a 3-hour delay at arrival. You may still be owed meals and drinks.', args: {} };
    const args = { km: Math.round(dist) };
    if (!fromEU) return { ok: true, amount, why: 'Covered if the airline is European. {km} km flight.', args };
    if (this.cancelled()) return { ok: true, amount, why: 'Cancelled with less than 14 days’ notice. {km} km flight.', args };
    return { ok: true, amount, why: 'Arrived 3 h or more late. {km} km flight.', args };
  });

  readonly letter = computed(() => {
    const f = this.flight(), v = this.verdict();
    if (!f || !v) return '';
    const date = new Date(f.departure).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: f.from.timezone });
    const what = this.cancelled()
      ? `was cancelled and I was informed less than 14 days before departure`
      : `arrived at ${f.to.city} approximately ${this.delay()} hours late`;
    const name = this.name().trim() || f.passengerName || '[your full name]';
    return [
      `Subject: EU261 compensation claim – flight ${f.number} on ${date}`,
      ``,
      `Dear ${f.airline} Customer Relations,`,
      ``,
      `I was a passenger on flight ${f.number} from ${f.from.city} (${f.from.code}) to ${f.to.city} (${f.to.code}) on ${date}, booking reference ${f.bookingRef || '[booking reference]'}. The flight ${what}.`,
      this.reason().trim() ? `The reason given was: ${this.reason().trim()}.` : ``,
      ``,
      `Under Regulation (EC) No 261/2004 (Article 7), and the judgments of the Court of Justice of the EU in Sturgeon (C-402/07) and Nelson (C-581/10), I am entitled to compensation of €${v.amount} for a flight of this distance.`,
      ``,
      `Please pay €${v.amount} by bank transfer within 14 days. My bank details:`,
      `Account holder: ${name}`,
      `IBAN: [your IBAN]`,
      ``,
      `If you consider that extraordinary circumstances apply, please provide evidence of them and of the reasonable measures taken to avoid the disruption. Otherwise I will refer the matter to the national enforcement body.`,
      ``,
      `Attached: boarding pass and booking confirmation.`,
      ``,
      `Kind regards,`,
      name,
    ].filter((l, i, all) => !(l === '' && all[i - 1] === '')).join('\n');
  });

  readonly mailto = computed(() => {
    const body = this.letter();
    const subject = body.split('\n')[0].replace(/^Subject: /, '');
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.split('\n').slice(2).join('\n'))}`;
  });

  constructor() {
    effect(() => {
      const f = this.flight();
      untracked(() => {
        if (!f) return;
        this.name.set(f.passengerName || '');
        this.delay.set(f.delayMinutes ? Math.max(0, Math.round((f.delayMinutes / 60) * 2) / 2) : 3.5);
        this.cancelled.set(f.status === 'cancelled');
        this.reason.set('');
      });
    });
  }

  ngOnInit() {
    void this.db.load().catch(() => {});
  }

  day(f: Flight) {
    return new Date(f.departure).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  async copy() {
    try {
      await navigator.clipboard.writeText(this.letter());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
    }
  }

  async share() {
    const text = this.letter();
    try {
      if (Capacitor.isNativePlatform()) await Share.share({ title: 'EU261 claim', text });
      else if (navigator.share) await navigator.share({ title: 'EU261 claim', text });
      else await this.copy();
    } catch {
    }
  }
}
