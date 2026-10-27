import { ChangeDetectionStrategy, Component, computed, inject, input, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { AirportDbService, AirportRecord, haversineKm } from '../../core/services/airport-db.service';
import { GatesService, MapFeature } from '../../core/services/gates.service';
import { directionsUrl, LocationService, walkMinutes } from '../../core/services/location.service';
import { PlatformService } from '../../core/services/platform.service';
import { PrefsService } from '../../core/services/prefs.service';
import { SatMapComponent } from '../../shared/components/sat-map.component';
import { AchievementsService } from '../../core/services/achievements.service';

@Component({
  selector: 'gm-airport-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, SatMapComponent],
  templateUrl: './airport-map.page.html',
  styleUrl: './airport-map.page.scss',
})
export class AirportMapPage implements OnInit, OnDestroy {
  readonly iata = input<string>();
  readonly gate = input<string>();

  private db = inject(AirportDbService);
  private gates = inject(GatesService);
  protected location = inject(LocationService);
  private platform = inject(PlatformService);
  private prefs = inject(PrefsService);
  private achievements = inject(AchievementsService);
  private map = viewChild(SatMapComponent);

  readonly airport = signal<AirportRecord | null>(null);
  readonly features = signal<MapFeature[] | null>(null);
  readonly selected = signal<string | null>(null);
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
    const t = this.target();
    const meters = haversineKm(me.lat, me.lon, t?.lat ?? a.lat, t?.lon ?? a.lon) * 1000;
    return { meters: Math.round(meters), minutes: walkMinutes(meters), toGate: !!t, far: meters > 3000 };
  });

  async ngOnInit() {
    void this.achievements.track('map_opened');
    await this.db.load();
    const a = this.db.get(this.iata() ?? this.prefs.homeAirport()) ?? this.db.get('OTP')!;
    this.airport.set(a);
    if (this.gate()) this.selected.set(this.gate()!);
    this.features.set(await this.gates.get(a));
  }

  ngOnDestroy() {
    void this.location.stop();
  }

  pick(ref: string) {
    this.platform.selection();
    this.selected.set(this.selected() === ref ? null : ref);
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
}
