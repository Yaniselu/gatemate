import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonIcon, IonRefresher, IonRefresherContent, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { TravelStore } from '../../core/services/travel.store';
import { PrefsService } from '../../core/services/prefs.service';
import { PlatformService } from '../../core/services/platform.service';
import { AirportDbService, AirportRecord, haversineKm } from '../../core/services/airport-db.service';
import { GatesService, MapFeature } from '../../core/services/gates.service';
import { POI_META, POI_ORDER, PoiKind } from '../../core/data/airport-poi';
import { openState } from '../../core/utils/opening-hours';
import { directionsUrl, LocationService, walkMinutes } from '../../core/services/location.service';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { AirportPlanComponent } from '../../shared/components/airport-plan.component';
import { AirportPickerComponent } from '../../shared/components/airport-picker.component';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { PressableDirective } from '../../shared/directives/pressable.directive';
import { locale, TranslatePipe } from '../../core/i18n/i18n.service';

@Component({
  selector: 'gm-airport',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, 
    IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonRefresher, IonRefresherContent, RouterLink,
    SkeletonComponent, AirportPlanComponent, AirportPickerComponent, RevealDirective, PressableDirective,
  ],
  templateUrl: './airport.page.html',
  styleUrl: './airport.page.scss',
})
export class AirportPage implements OnInit {
  protected store = inject(TravelStore);
  private prefs = inject(PrefsService);
  private platform = inject(PlatformService);
  protected db = inject(AirportDbService);
  private gatesSvc = inject(GatesService);
  protected location = inject(LocationService);
  private router = inject(Router);

  protected readonly meta = POI_META;
  readonly airport = signal<AirportRecord | null>(null);
  readonly features = signal<MapFeature[] | null>(null);
  readonly picking = signal(false);
  readonly gatesError = signal(false);
  readonly category = signal<PoiKind | 'all'>('all');
  readonly terminal = signal<string | 'all'>('all');
  readonly query = signal('');
  readonly limit = signal(25);
  readonly refreshing = signal(false);
  readonly openRule = signal<string | null>(null);
  private now = signal(Date.now());

  /** The user's next flight leaving from the airport on screen. */
  readonly myFlight = computed(() => {
    const n = this.store.nextFlight();
    return n && n.flight.from.code === this.airport()?.iata ? n.flight : null;
  });
  readonly gateFeature = computed(() => {
    const g = this.myFlight()?.gate?.toUpperCase();
    return g ? this.features()?.find((f) => f.kind === 'gate' && f.ref.toUpperCase() === g) : undefined;
  });
  readonly gateCount = computed(() => this.features()?.filter((f) => f.kind === 'gate').length ?? 0);
  readonly distanceToAirportKm = computed(() => {
    const a = this.airport(), f = this.location.fix();
    return a && f ? haversineKm(f.lat, f.lon, a.lat, a.lon) : null;
  });
  readonly gateDistance = computed(() => {
    const g = this.gateFeature(), f = this.location.fix();
    if (!g || !f) return null;
    const m = haversineKm(f.lat, f.lon, g.lat, g.lon) * 1000;
    return { meters: Math.round(m), minutes: walkMinutes(m) };
  });
  /** Where distances are measured from: your gate, else you (when at the airport), else the airport centre. */
  private origin = computed(() => {
    const fix = this.location.fix();
    return this.gateFeature() ?? (fix && (this.distanceToAirportKm() ?? 99) < 3 ? { lat: fix.lat, lon: fix.lon } : this.airport());
  });
  readonly places = computed(() => (this.features() ?? []).filter((f) => f.kind === 'poi'));
  readonly terminals = computed(() =>
    (this.features() ?? []).filter((f) => f.kind === 'terminal').sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true })),
  );
  readonly terminalNames = computed(() => [...new Set(this.terminals().map((t) => t.ref))]);
  /** Places matching the search and terminal filter, before the category filter (for the chip counts). */
  private matching = computed(() => {
    const q = fold(this.query().trim());
    const term = this.terminal();
    return this.places().filter((f) => {
      if (term !== 'all' && f.terminal !== term) return false;
      if (!q) return true;
      const hay = fold([f.ref, POI_META[f.poi!].label, f.brand, f.detail, f.terminal, f.level ? 'level ' + f.level : ''].filter(Boolean).join(' '));
      return q.split(/\s+/).every((w) => hay.includes(w));
    });
  });
  readonly categories = computed(() => {
    const count = new Map<PoiKind, number>();
    for (const f of this.matching()) count.set(f.poi!, (count.get(f.poi!) ?? 0) + 1);
    return POI_ORDER.filter((k) => count.has(k)).map((k) => ({ kind: k, count: count.get(k)! }));
  });
  readonly results = computed(() => {
    const c = this.category();
    const from = this.origin();
    const tz = this.airport()?.tz ?? 'UTC';
    const now = this.now();
    return this.matching()
      .filter((f) => c === 'all' || f.poi === c)
      .map((f) => ({ ...f, meters: from ? Math.round(haversineKm(from.lat, from.lon, f.lat, f.lon) * 1000) : 0, open: openState(f.hours, tz, now) }))
      .sort((x, y) => x.meters - y.meters);
  });
  readonly visible = computed(() => this.results().slice(0, this.limit()));
  /** Gates matching the search ("B12"), shown above the places. */
  readonly gateHits = computed(() => {
    const q = this.query().trim().toUpperCase().replace(/^GATE\s*/, '');
    if (!q) return [];
    return (this.features() ?? []).filter((f) => f.kind === 'gate' && f.ref.toUpperCase().startsWith(q)).slice(0, 6);
  });
  readonly terminalSummary = computed(() =>
    this.terminals().map((t) => {
      const here = this.places().filter((p) => p.terminal === t.ref);
      const n = (k: PoiKind[]) => here.filter((p) => k.includes(p.poi!)).length;
      return { name: t.ref, total: here.length, eat: n(['coffee', 'food', 'bar']), shop: n(['shop', 'dutyfree']), gates: (this.features() ?? []).filter((g) => g.kind === 'gate' && g.terminal === t.ref).length };
    }),
  );
  readonly localTime = computed(() => {
    const a = this.airport();
    return a ? new Date(this.now()).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', timeZone: a.tz }) : '';
  });

  readonly rules = [
    { id: 'liquids', icon: 'water-outline', title: 'Liquids in cabin', body: 'In the EU and UK each container may hold at most 100 ml, all inside one transparent, resealable bag of about 1 litre. Some airports with new CT scanners allow more — check your departure airport. Medicines and baby food are allowed in larger amounts; declare them at security.' },
    { id: 'batteries', icon: 'battery-charging-outline', title: 'Batteries & power banks', body: 'Lithium batteries and power banks must travel in your cabin bag, never in checked luggage. Up to 100 Wh is allowed without approval; 100–160 Wh needs airline approval; above 160 Wh is forbidden.' },
    { id: 'sharp', icon: 'warning-outline', title: 'Sharp objects', body: 'Knives, scissors with blades longer than 6 cm and most tools are not allowed in the cabin. Pack them in checked baggage.' },
    { id: 'arrive', icon: 'time-outline', title: 'When to arrive', body: 'Airlines usually recommend 2 hours before departure for Schengen/domestic flights and 3 hours for other international flights. Check-in and bag drop typically close 40–60 minutes before departure — your airline’s rules apply.' },
  ];

  constructor() {
    const t = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  async ngOnInit() {
    await Promise.all([this.store.loadTrips(), this.db.load()]);
    const n = this.store.nextFlight();
    const soon = n && new Date(n.flight.departure).getTime() - Date.now() < 48 * 3600_000;
    this.select(this.db.get(soon ? n!.flight.from.code : this.prefs.homeAirport()) ?? this.db.get('OTP')!);
  }

  select(a: AirportRecord) {
    this.picking.set(false);
    this.airport.set(a);
    this.features.set(null);
    this.category.set('all');
    this.terminal.set('all');
    this.query.set('');
    this.limit.set(25);
    this.gatesError.set(false);
    void this.gatesSvc.get(a).then((f) => this.airport()?.iata === a.iata && this.features.set(f)).catch(() => {
      if (this.airport()?.iata !== a.iata) return;
      this.gatesError.set(true);
      this.features.set([]);
    });
  }

  async refresh(ev: CustomEvent) {
    const a = this.airport();
    if (a) {
      this.refreshing.set(true);
      await this.gatesSvc
        .refresh(a)
        .then((f) => this.airport()?.iata === a.iata && (this.features.set(f), this.gatesError.set(false)))
        .catch(() => {});
      this.refreshing.set(false);
    }
    void this.location.locate();
    (ev.target as HTMLIonRefresherElement).complete();
  }

  retry() {
    const a = this.airport();
    if (a) this.select(a);
  }

  errorDetail() {
    return this.gatesSvc.lastError;
  }

  setCategory(c: PoiKind | 'all') {
    this.platform.selection();
    this.category.set(this.category() === c ? 'all' : c);
    this.limit.set(25);
  }

  setTerminal(t: string | 'all') {
    this.platform.selection();
    this.terminal.set(this.terminal() === t ? 'all' : t);
    this.limit.set(25);
  }

  onSearch(ev: Event) {
    this.query.set((ev.target as HTMLInputElement).value.slice(0, 60));
    this.limit.set(25);
  }

  openPlace(f: MapFeature) {
    const a = this.airport();
    if (!a) return;
    this.platform.tap();
    void this.router.navigate(['/airport-map', a.iata], { queryParams: f.kind === 'gate' ? { gate: f.ref } : { place: f.id } });
  }

  dist(m: number) {
    return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
  }

  toggleRule(id: string) {
    this.platform.tap();
    this.openRule.update((v) => (v === id ? null : id));
  }

  directions() {
    const a = this.airport();
    if (a) window.open(directionsUrl(a.lat, a.lon, a.name, this.platform.platform === 'ios'), '_blank', 'noopener');
  }

  km(n: number) {
    return n < 1 ? `${Math.round(n * 1000)} m` : n < 100 ? `${n.toFixed(1)} km` : `${Math.round(n)} km`;
  }
}

function fold(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
