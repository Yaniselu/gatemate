import { ChangeDetectionStrategy, Component, computed, inject, input, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { AirportDbService, AirportRecord, haversineKm } from '../../core/services/airport-db.service';
import { GatesService, MapFeature, PLAN_VIEW } from '../../core/services/gates.service';
import { directionsUrl, LocationService, walkMinutes } from '../../core/services/location.service';
import { PlatformService } from '../../core/services/platform.service';
import { PrefsService } from '../../core/services/prefs.service';
import { AirportPlanComponent, levelsOf } from '../../shared/components/airport-plan.component';
import { POI_META, POI_ORDER, PoiKind } from '../../core/data/airport-poi';
import { openState } from '../../core/utils/opening-hours';
import { AchievementsService } from '../../core/services/achievements.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';

@Component({
  selector: 'gm-airport-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, AirportPlanComponent],
  templateUrl: './airport-map.page.html',
  styleUrl: './airport-map.page.scss',
})
export class AirportMapPage implements OnInit, OnDestroy {
  readonly iata = input<string>();
  readonly gate = input<string>();
  readonly place = input<string>();

  private db = inject(AirportDbService);
  private gates = inject(GatesService);
  protected location = inject(LocationService);
  private platform = inject(PlatformService);
  private prefs = inject(PrefsService);
  private achievements = inject(AchievementsService);
  private map = viewChild(AirportPlanComponent);

  readonly airport = signal<AirportRecord | null>(null);
  readonly features = signal<MapFeature[] | null>(null);
  readonly selected = signal<string | null>(null);
  readonly placeId = signal<string | null>(null);
  protected readonly meta = POI_META;
  readonly category = signal<PoiKind | null>(null);
  readonly levels = computed(() => levelsOf(this.features() ?? []));
  readonly pickedLevel = signal<string | null>(null);
  readonly level = computed(() => {
    const all = this.levels();
    if (all.length < 2) return null;
    const p = this.pickedLevel();
    if (p && all.includes(p)) return p;
    const count = new Map<string, number>();
    for (const f of this.features() ?? []) if (f.kind === 'poi' && f.level && all.includes(f.level)) count.set(f.level, (count.get(f.level) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? all[0];
  });
  readonly categories = computed(() => {
    const have = new Set((this.features() ?? []).filter((f) => f.kind === 'poi').map((f) => f.poi!));
    return POI_ORDER.filter((k) => have.has(k));
  });
  readonly placeFeature = computed(() => (this.placeId() ? (this.features() ?? []).find((f) => f.id === this.placeId()) : undefined));
  readonly placeOpen = computed(() => {
    const p = this.placeFeature(), a = this.airport();
    return p && a ? openState(p.hours, a.tz) : null;
  });
  readonly gateList = computed(() =>
    (this.features() ?? []).filter((f) => f.kind === 'gate').sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true })),
  );
  readonly target = computed(() => this.gateList().find((g) => g.ref.toUpperCase() === this.selected()?.toUpperCase()));
  readonly me = computed(() => {
    const f = this.location.fix();
    return f ? { lat: f.lat, lon: f.lon } : null;
  });
  readonly distance = computed(() => {
    const me = this.me(), a = this.airport();
    if (!me || !a) return null;
    const t = this.placeFeature() ?? this.target();
    const meters = haversineKm(me.lat, me.lon, t?.lat ?? a.lat, t?.lon ?? a.lon) * 1000;
    return { meters: Math.round(meters), minutes: walkMinutes(meters), toGate: !!t, far: meters > 3000 };
  });

  async ngOnInit() {
    void this.achievements.track('map_opened');
    await this.db.load();
    const a = this.db.get(this.iata() ?? this.prefs.homeAirport()) ?? this.db.get('OTP')!;
    this.airport.set(a);
    if (this.gate()) this.selected.set(this.gate()!);
    if (this.place()) this.placeId.set(this.place()!);
    const lvl = () => (this.features() ?? []).find((f) => f.id === this.place())?.level?.split(';')[0]?.trim();
    await this.loadGates();
    const l = this.place() ? lvl() : undefined;
    if (l) this.pickedLevel.set(l);
  }

  readonly gatesError = signal(false);

  async loadGates() {
    const a = this.airport();
    if (!a) return;
    this.gatesError.set(false);
    this.features.set(null);
    try {
      this.features.set(await this.gates.get(a));
    } catch {
      this.gatesError.set(true);
      this.features.set([]);
    }
  }

  ngOnDestroy() {
    void this.location.stop();
  }

  pick(ref: string) {
    this.platform.selection();
    this.placeId.set(null);
    this.selected.set(this.selected() === ref ? null : ref);
  }

  pickPlace(id: string) {
    this.platform.selection();
    this.selected.set(null);
    this.placeId.set(this.placeId() === id ? null : id);
  }

  setLevel(l: string) {
    this.platform.selection();
    this.pickedLevel.set(l);
  }

  levelName(l: string) {
    return l === '0' ? 'G' : l;
  }

  setCategory(c: PoiKind | null) {
    this.platform.selection();
    this.category.set(c);
  }

  targetLabel(): string {
    const p = this.placeFeature();
    if (p) return 'To ' + p.ref;
    return this.selected() ? 'To gate ' + this.selected() : 'To the airport';
  }

  async locateMe() {
    this.platform.tap();
    if (await this.location.locate()) void this.location.watch();
  }

  directions() {
    const a = this.airport();
    if (a) window.open(directionsUrl(a.lat, a.lon, a.name, this.platform.platform === 'ios'), '_blank', 'noopener');
  }

  zoom(d: number) {
    this.platform.tap();
    this.map()?.zoomBy(d);
  }

  recenter() {
    this.platform.tap();
    this.map()?.recenter();
  }

  fmt(m: number) {
    return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
  }

  view(a: { iata: string; lat: number; lon: number }) {
    const v = PLAN_VIEW[a.iata];
    return v ? { lat: v.lat, lon: v.lon } : { lat: a.lat, lon: a.lon };
  }

  planZoom(a: { iata: string }, fallback: number, preview = false) {
    const v = PLAN_VIEW[a.iata];
    return v ? (preview ? v.preview : v.zoom) : fallback;
  }
}
