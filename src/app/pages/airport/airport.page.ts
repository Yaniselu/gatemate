import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonIcon, IonRefresher, IonRefresherContent, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { TravelStore } from '../../core/services/travel.store';
import { PrefsService } from '../../core/services/prefs.service';
import { PlatformService } from '../../core/services/platform.service';
import { AirportDbService, AirportRecord, haversineKm } from '../../core/services/airport-db.service';
import { GatesService, MapFeature, PoiKind } from '../../core/services/gates.service';
import { directionsUrl, LocationService, walkMinutes } from '../../core/services/location.service';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { SatMapComponent } from '../../shared/components/sat-map.component';
import { AirportPickerComponent } from '../../shared/components/airport-picker.component';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { PressableDirective } from '../../shared/directives/pressable.directive';

const POI_META: Record<PoiKind, { label: string; icon: string }> = {
  food: { label: 'Food & drink', icon: 'restaurant-outline' },
  pharmacy: { label: 'Pharmacy', icon: 'medkit-outline' },
  toilets: { label: 'Toilets', icon: 'water-outline' },
  money: { label: 'ATM & exchange', icon: 'cash-outline' },
  charging: { label: 'Charging', icon: 'battery-charging-outline' },
  shop: { label: 'Shops', icon: 'storefront-outline' },
  info: { label: 'Information', icon: 'information-circle-outline' },
};

@Component({
  selector: 'gm-airport',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonRefresher, IonRefresherContent, RouterLink,
    SkeletonComponent, SatMapComponent, AirportPickerComponent, RevealDirective, PressableDirective,
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

  protected readonly meta = POI_META;
  readonly airport = signal<AirportRecord | null>(null);
  readonly features = signal<MapFeature[] | null>(null);
  readonly picking = signal(false);
  readonly category = signal<PoiKind | 'all'>('all');
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
  readonly pois = computed(() => {
    const a = this.airport();
    const c = this.category();
    const from = this.gateFeature() ?? (this.location.fix() && (this.distanceToAirportKm() ?? 99) < 3 ? { lat: this.location.fix()!.lat, lon: this.location.fix()!.lon } : a);
    return (this.features() ?? [])
      .filter((f) => f.kind === 'poi' && (c === 'all' || f.poi === c))
      .map((f) => ({ ...f, meters: from ? Math.round(haversineKm(from.lat, from.lon, f.lat, f.lon) * 1000) : 0 }))
      .sort((x, y) => x.meters - y.meters)
      .slice(0, 12);
  });
  readonly categories = computed(() => [...new Set((this.features() ?? []).filter((f) => f.kind === 'poi').map((f) => f.poi!))]);
  readonly localTime = computed(() => {
    const a = this.airport();
    return a ? new Date(this.now()).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: a.tz }) : '';
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
    void this.gatesSvc.get(a).then((f) => this.airport()?.iata === a.iata && this.features.set(f));
  }

  async refresh(ev: CustomEvent) {
    const a = this.airport();
    if (a) this.select(a);
    await this.location.locate();
    (ev.target as HTMLIonRefresherElement).complete();
  }

  setCategory(c: PoiKind | 'all') {
    this.platform.selection();
    this.category.set(c);
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
