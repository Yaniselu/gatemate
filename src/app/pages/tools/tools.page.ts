import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { AirportDbService, AirportRecord, haversineKm } from '../../core/services/airport-db.service';
import { FX_CURRENCIES, FxRate, FxService } from '../../core/services/fx.service';
import { PrefsService } from '../../core/services/prefs.service';
import { TravelStore } from '../../core/services/travel.store';
import { PlatformService } from '../../core/services/platform.service';
import { AirportPickerComponent } from '../../shared/components/airport-picker.component';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { locale, t as tr, TranslatePipe } from '../../core/i18n/i18n.service';

type Tool = 'money' | 'time' | 'cabin' | 'distance';
type PickTarget = 'home' | 'away' | 'from' | 'to';

interface CabinRule { item: string; icon: string; cabin: 'yes' | 'no' | 'limited'; hold: 'yes' | 'no' | 'limited'; note: string }

/** Rules that apply on almost every airline (ICAO/IATA dangerous-goods rules, EU/UK/US screening). */
const CABIN_RULES: CabinRule[] = [
  { item: 'Liquids, gels, aerosols', icon: 'water-outline', cabin: 'limited', hold: 'yes', note: 'Containers up to 100 ml in one clear, resealable bag of about 1 litre. Some airports with new CT scanners allow more — check yours.' },
  { item: 'Power bank', icon: 'battery-charging-outline', cabin: 'limited', hold: 'no', note: 'Cabin only. Up to 100 Wh is fine; 100–160 Wh needs airline approval; over 160 Wh is forbidden.' },
  { item: 'Spare lithium batteries', icon: 'battery-half-outline', cabin: 'limited', hold: 'no', note: 'Cabin only, terminals protected (original packaging or tape).' },
  { item: 'E-cigarettes & vapes', icon: 'cloud-outline', cabin: 'limited', hold: 'no', note: 'Cabin only; never use or charge them on board.' },
  { item: 'Laptop, tablet, phone', icon: 'laptop-outline', cabin: 'yes', hold: 'limited', note: 'Best in the cabin. If checked, switch them fully off.' },
  { item: 'Prescription medicine', icon: 'medkit-outline', cabin: 'yes', hold: 'yes', note: 'Liquid medicine over 100 ml is allowed with a prescription or doctor’s note. Keep it in your cabin bag.' },
  { item: 'Baby food & milk', icon: 'happy-outline', cabin: 'yes', hold: 'yes', note: 'Allowed in reasonable quantities for the journey; may be screened separately.' },
  { item: 'Lighter / matches', icon: 'flame-outline', cabin: 'limited', hold: 'no', note: 'Usually one small lighter or one box of safety matches, carried on your person.' },
  { item: 'Knives & scissors', icon: 'cut-outline', cabin: 'no', hold: 'yes', note: 'No knives in the cabin. Scissors with blades under 6 cm are allowed in many countries.' },
  { item: 'Razors', icon: 'remove-outline', cabin: 'limited', hold: 'yes', note: 'Disposable and electric razors are fine; loose razor blades only in checked bags.' },
  { item: 'Sports bats, clubs, tools', icon: 'construct-outline', cabin: 'no', hold: 'yes', note: 'Checked baggage only.' },
  { item: 'Duty-free liquids', icon: 'bag-outline', cabin: 'limited', hold: 'yes', note: 'Keep them sealed in the shop’s tamper-evident bag with the receipt, especially when connecting.' },
];

@Component({
  selector: 'gm-tools',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonIcon, FormsModule, DecimalPipe, AirportPickerComponent, RevealDirective],
  templateUrl: './tools.page.html',
  styleUrl: './tools.page.scss',
})
export class ToolsPage {
  private db = inject(AirportDbService);
  private fxSvc = inject(FxService);
  private prefs = inject(PrefsService);
  private store = inject(TravelStore);
  private platform = inject(PlatformService);

  readonly tool = signal<Tool>('money');
  readonly tools: { id: Tool; label: string; icon: string }[] = [
    { id: 'money', label: 'Currency', icon: 'cash-outline' },
    { id: 'time', label: 'Time & jet lag', icon: 'time-outline' },
    { id: 'cabin', label: 'Cabin bag rules', icon: 'bag-check-outline' },
    { id: 'distance', label: 'Distance', icon: 'swap-horizontal-outline' },
  ];
  readonly currencies = FX_CURRENCIES;
  readonly rules = CABIN_RULES;
  readonly openRule = signal<string | null>(null);
  readonly ruleQuery = signal('');
  readonly filteredRules = computed(() => {
    const q = this.ruleQuery().trim().toLowerCase();
    return q ? this.rules.filter((r) => (r.item + ' ' + r.note).toLowerCase().includes(q)) : this.rules;
  });

  // ---- currency ----
  readonly from = signal('EUR');
  readonly to = signal('RON');
  readonly amount = signal(100);
  readonly fx = signal<FxRate | null>(null);
  readonly fxState = signal<'loading' | 'ready' | 'error'>('loading');
  readonly result = computed(() => (this.fx() ? this.amount() * this.fx()!.rate : null));

  // ---- time ----
  readonly picking = signal<PickTarget | null>(null);
  readonly home = signal<AirportRecord | undefined>(undefined);
  readonly away = signal<AirportRecord | undefined>(undefined);
  readonly hour = signal(new Date().getHours());
  private now = signal(Date.now());
  readonly offsetH = computed(() => {
    const h = this.home(), a = this.away();
    return h && a ? tzOffset(a.tz, this.now()) - tzOffset(h.tz, this.now()) : 0;
  });
  readonly awayHour = computed(() => (((this.hour() + this.offsetH()) % 24) + 24) % 24);
  readonly clock = (tz: string) => new Date(this.now()).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', timeZone: tz });
  readonly jetlag = computed(() => {
    const d = this.offsetH();
    const abs = Math.abs(d);
    if (abs < 3) return { level: 'none' as const, days: 0, steps: [] as string[] };
    const east = d > 0;
    const days = Math.min(3, Math.ceil(abs / 2));
    const steps = [
      days > 1 ? tr(east ? '{n} days before: go to bed and wake up about an hour earlier each day.' : '{n} days before: go to bed and wake up about an hour later each day.', { n: days }) : tr(east ? '1 day before: go to bed and wake up about an hour earlier.' : '1 day before: go to bed and wake up about an hour later.'),
      tr('On the flight: set your watch to {city} time and sleep only if it’s night there.', { city: this.away()?.city ?? '' }),
      east
        ? tr('On arrival: get outdoor light in the morning, avoid bright light late in the evening.')
        : tr('On arrival: get outdoor light in the late afternoon and evening; stay up until local bedtime.'),
      tr('Short naps only (under 30 min) and no caffeine after 2 pm local time.'),
    ];
    return { level: abs >= 6 ? ('strong' as const) : ('mild' as const), days, steps, east, recovery: Math.round(abs / (east ? 1 : 1.5)) };
  });

  // ---- distance ----
  readonly a = signal<AirportRecord | undefined>(undefined);
  readonly b = signal<AirportRecord | undefined>(undefined);
  readonly km = computed(() => (this.a() && this.b() ? haversineKm(this.a()!.lat, this.a()!.lon, this.b()!.lat, this.b()!.lon) : null));
  /** Block time estimate: 30 min taxi/climb + cruise ~800 km/h. */
  readonly minutes = computed(() => (this.km() === null ? null : Math.round(30 + (this.km()! / 800) * 60)));
  readonly eu261 = computed(() => {
    const k = this.km();
    if (k === null) return null;
    return k <= 1500 ? 250 : k <= 3500 ? 400 : 600;
  });

  constructor() {
    effect(() => {
      const f = this.from(), t = this.to();
      this.fxState.set('loading');
      this.fxSvc.rate(f, t).then((r) => {
        if (this.from() === f && this.to() === t) {
          this.fx.set(r);
          this.fxState.set('ready');
        }
      }).catch(() => this.fxState.set('error'));
    });
    const t = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
    void this.init();
  }

  private async init() {
    await Promise.all([this.db.load(), this.store.loadTrips().catch(() => {})]);
    const home = this.db.get(this.prefs.homeAirport()) ?? this.db.get('OTP');
    const next = this.store.upcomingTrips()[0];
    const away = (next && this.db.get(next.destination.code)) ?? this.db.get('JFK');
    this.home.set(home);
    this.away.set(away);
    this.a.set(home);
    this.b.set(away);
    const cur = (ap?: AirportRecord) => (ap ? this.db.country(ap.country)?.currency?.[0] : undefined);
    const hc = cur(home), ac = cur(away);
    if (hc && FX_CURRENCIES.includes(hc)) this.from.set(hc);
    if (ac && FX_CURRENCIES.includes(ac) && ac !== this.from()) this.to.set(ac);
    else if (this.from() === this.to()) this.to.set(this.from() === 'EUR' ? 'USD' : 'EUR');
  }

  select(t: Tool) {
    this.platform.selection();
    this.tool.set(t);
  }

  swap() {
    this.platform.selection();
    const f = this.from();
    this.from.set(this.to());
    this.to.set(f);
  }

  setAmount(v: number | string) {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    this.amount.set(Number.isFinite(n) && n >= 0 ? Math.min(n, 1e9) : 0);
  }

  picked(a: AirportRecord) {
    const t = this.picking();
    this.picking.set(null);
    if (t === 'home') this.home.set(a);
    if (t === 'away') this.away.set(a);
    if (t === 'from') this.a.set(a);
    if (t === 'to') this.b.set(a);
  }

  fmtHour(h: number) {
    const mins = Math.round(h * 60) % 1440;
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  }

  currencyName(code: string) {
    try {
      return new Intl.DisplayNames([locale()], { type: 'currency' }).of(code) ?? code;
    } catch {
      return code;
    }
  }
}

function tzOffset(tz: string, at: number): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date(at));
  const m = parts.find((p) => p.type === 'timeZoneName')?.value.match(/GMT([+-]\d+)(?::(\d+))?/);
  if (!m) return 0;
  const h = +m[1];
  return h + (h < 0 || m[1].startsWith('-') ? -1 : 1) * (+(m[2] ?? 0) / 60);
}
