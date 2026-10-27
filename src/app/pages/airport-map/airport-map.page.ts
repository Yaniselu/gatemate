import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { Geolocation } from '@capacitor/geolocation';
import { EDGES, GATES, MapGate, MapNode, METERS_PER_UNIT, NODES, POIS, route, WALK_M_PER_MIN } from '../../core/data/terminal-map';
import { TravelStore } from '../../core/services/travel.store';
import { PlatformService } from '../../core/services/platform.service';
import { ToastService } from '../../core/services/toast.service';

const AIRPORT_POS = { lat: 44.5711, lng: 26.085 };
const POI_ICON: Record<string, string> = {
  food: 'cafe-outline', restroom: 'water-outline', lounge: 'bed-outline', pharmacy: 'medkit-outline',
  charging: 'battery-charging-outline', shop: 'storefront-outline', info: 'information-circle-outline',
};

interface StepView {
  icon: string;
  text: string;
  meters: number;
}

@Component({
  selector: 'gm-airport-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, TitleCasePipe],
  templateUrl: './airport-map.page.html',
  styleUrl: './airport-map.page.scss',
})
export class AirportMapPage implements OnInit {
  private store = inject(TravelStore);
  private platform = inject(PlatformService);
  private toast = inject(ToastService);

  readonly nodes = NODES;
  readonly edges = EDGES.map(([a, b]) => [NODES.find((n) => n.id === a)!, NODES.find((n) => n.id === b)!]);
  readonly gates = GATES;
  readonly pois = POIS;
  readonly poiIcon = POI_ICON;

  readonly start = signal<'entrance' | 'security'>('security');
  readonly gateId = signal('B12');
  readonly gate = computed<MapGate>(() => GATES.find((g) => g.id === this.gateId()) ?? GATES[0]);
  readonly path = computed<MapNode[]>(() => route(this.start(), this.gate().node));
  readonly pathD = computed(() => {
    const pts = this.path().map((n) => `${n.x} ${n.y}`);
    const g = this.gate();
    return pts.length ? `M${pts.join(' L')} L${g.x} ${g.y}` : '';
  });
  readonly meters = computed(() => {
    const pts = [...this.path(), { x: this.gate().x, y: this.gate().y }];
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return Math.round(total * METERS_PER_UNIT);
  });
  readonly minutes = computed(() => Math.max(1, Math.round(this.meters() / WALK_M_PER_MIN)));
  readonly steps = computed<StepView[]>(() => {
    const p = this.path();
    const out: StepView[] = [];
    for (let i = 1; i < p.length; i++) {
      const seg = Math.round(Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y) * METERS_PER_UNIT);
      if (p[i].label) out.push({ icon: p[i].id === 'passport' ? 'id-card-outline' : 'navigate-outline', text: `Continue to ${p[i].label}`, meters: seg });
      else if (out.length && !out[out.length - 1].text.startsWith('Walk along')) out.push({ icon: 'walk-outline', text: `Walk along Pier ${this.gate().pier}`, meters: seg });
      else if (out.length) out[out.length - 1].meters += seg;
      else out.push({ icon: 'walk-outline', text: 'Head towards the piers', meters: seg });
    }
    out.push({ icon: 'flag-outline', text: `Gate ${this.gate().id} is on your ${this.gate().x < (p[p.length - 1]?.x ?? 0) ? 'left' : 'right'}`, meters: 0 });
    return out;
  });
  readonly sheetOpen = signal(false);
  readonly selectedPoi = signal<(typeof POIS)[number] | null>(null);
  readonly locating = signal(false);
  readonly locationNote = signal<string | null>(null);

  // Pan & pinch-zoom state
  readonly scale = signal(1);
  readonly tx = signal(0);
  readonly ty = signal(0);
  private pointers = new Map<number, { x: number; y: number }>();
  private lastDist = 0;

  ngOnInit(): void {
    void this.store.loadTrips().then(() => {
      const g = this.store.nextFlight()?.flight.gate;
      if (g && GATES.some((x) => x.id === g)) this.gateId.set(g);
    });
  }

  selectGate(id: string) {
    this.platform.selection();
    this.gateId.set(id);
    this.selectedPoi.set(null);
  }

  setStart(s: 'entrance' | 'security') {
    this.platform.selection();
    this.start.set(s);
  }

  /** Coarse "am I at the airport?" check. Precise indoor positioning needs the airport's indoor-map provider. */
  async locate() {
    this.locating.set(true);
    try {
      if (this.platform.isNative) {
        const perm = await Geolocation.requestPermissions({ permissions: ['location'] });
        if (perm.location !== 'granted') throw new Error('denied');
      }
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 });
      const km = haversineKm(pos.coords.latitude, pos.coords.longitude, AIRPORT_POS.lat, AIRPORT_POS.lng);
      if (km < 2) {
        this.setStart('entrance');
        this.locationNote.set('You’re at the airport — route starts at the entrance.');
      } else {
        this.locationNote.set(`You’re ${km < 100 ? km.toFixed(1) : Math.round(km)} km away. The route starts after security.`);
      }
      this.platform.success();
    } catch {
      await this.toast.show('Location is off. You can still follow the route from security.', 'info', 'location-outline');
    } finally {
      this.locating.set(false);
    }
  }

  zoom(delta: number) {
    this.platform.tap();
    this.scale.update((s) => clamp(s * delta, 0.8, 3));
  }

  recenter() {
    this.platform.tap();
    this.scale.set(1);
    this.tx.set(0);
    this.ty.set(0);
  }

  down(e: PointerEvent) {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.lastDist = this.pinchDistance();
  }

  move(e: PointerEvent) {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      const d = this.pinchDistance();
      if (this.lastDist) this.scale.update((s) => clamp(s * (d / this.lastDist), 0.8, 3));
      this.lastDist = d;
    } else {
      this.tx.update((v) => v + (e.clientX - prev.x));
      this.ty.update((v) => v + (e.clientY - prev.y));
    }
  }

  up(e: PointerEvent) {
    this.pointers.delete(e.pointerId);
    this.lastDist = this.pinchDistance();
  }

  wheel(e: WheelEvent) {
    e.preventDefault();
    this.scale.update((s) => clamp(s * (e.deltaY < 0 ? 1.1 : 0.9), 0.8, 3));
  }

  private pinchDistance(): number {
    const p = [...this.pointers.values()];
    return p.length === 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
