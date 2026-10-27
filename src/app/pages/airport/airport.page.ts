import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { IonContent, IonHeader, IonIcon, IonRefresher, IonRefresherContent, IonTitle, IonToolbar, ActionSheetController } from '@ionic/angular/standalone';
import { TravelStore } from '../../core/services/travel.store';
import { PrefsService } from '../../core/services/prefs.service';
import { ToastService } from '../../core/services/toast.service';
import { PlatformService } from '../../core/services/platform.service';
import { AIRPORTS } from '../../core/data/mock-data';
import { PoiCategory } from '../../core/models';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { PressableDirective } from '../../shared/directives/pressable.directive';

const CATEGORY_META: Record<PoiCategory, { label: string; icon: string; color: string }> = {
  food: { label: 'Food', icon: 'restaurant-outline', color: '#FF8A5B' },
  lounge: { label: 'Lounges', icon: 'bed-outline', color: '#8B7CF6' },
  charging: { label: 'Charging', icon: 'battery-charging-outline', color: '#2FD18A' },
  pharmacy: { label: 'Pharmacy', icon: 'medkit-outline', color: '#FF5A5F' },
  shopping: { label: 'Shopping', icon: 'storefront-outline', color: '#FFB020' },
  restroom: { label: 'Restrooms', icon: 'water-outline', color: '#5EC8FF' },
  wifi: { label: 'Wi-Fi', icon: 'wifi-outline', color: '#0FB5C3' },
  family: { label: 'Family', icon: 'happy-outline', color: '#5EC8FF' },
};

@Component({
  selector: 'gm-airport',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonRefresher, IonRefresherContent, SkeletonComponent, RevealDirective, PressableDirective],
  templateUrl: './airport.page.html',
  styleUrl: './airport.page.scss',
})
export class AirportPage implements OnInit {
  protected store = inject(TravelStore);
  private prefs = inject(PrefsService);
  private sheet = inject(ActionSheetController);
  private toast = inject(ToastService);
  private platform = inject(PlatformService);

  protected readonly meta = CATEGORY_META;
  readonly category = signal<PoiCategory | 'all'>('all');
  readonly openRule = signal<string | null>(null);
  readonly info = this.store.airport;
  readonly gate = computed(() => this.store.nextFlight()?.flight.gate);

  readonly categories = computed(() => {
    const cats = new Set(this.info()?.pois.map((p) => p.category) ?? []);
    return [...cats];
  });
  readonly pois = computed(() => {
    const c = this.category();
    return (this.info()?.pois ?? []).filter((p) => c === 'all' || p.category === c);
  });

  readonly rules = [
    { id: 'liquids', icon: 'water-outline', title: 'Liquids in cabin', body: 'Each container max 100 ml, all inside one transparent, resealable 1-litre bag. Medicines and baby food are allowed in larger amounts — declare them at security.' },
    { id: 'batteries', icon: 'battery-charging-outline', title: 'Batteries & power banks', body: 'Lithium batteries and power banks must travel in your cabin bag. Up to 100 Wh is allowed without approval; 100–160 Wh needs airline approval.' },
    { id: 'sharp', icon: 'warning-outline', title: 'Sharp objects', body: 'Knives, scissors with blades over 6 cm and tools are not allowed in the cabin. Pack them in checked baggage.' },
    { id: 'size', icon: 'briefcase-outline', title: 'Cabin bag size', body: 'Typical limit is 55 × 40 × 20 cm and 7–10 kg, plus one personal item. Always check your airline — rules differ.' },
  ];

  ngOnInit(): void {
    void this.store.loadTrips();
    void this.store.loadAirport(this.prefs.homeAirport());
  }

  async refresh(ev: CustomEvent) {
    await this.store.loadAirport(this.prefs.homeAirport(), true);
    (ev.target as HTMLIonRefresherElement).complete();
  }

  async chooseAirport() {
    const sheet = await this.sheet.create({
      header: 'Choose airport',
      cssClass: 'gm-sheet',
      buttons: [
        ...Object.values(AIRPORTS).map((a) => ({
          text: `${a.code} · ${a.city}`,
          handler: () => {
            void this.prefs.setHomeAirport(a.code);
            void this.store.loadAirport(a.code);
          },
        })),
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  setCategory(c: PoiCategory | 'all') {
    this.platform.selection();
    this.category.set(c);
  }

  toggleRule(id: string) {
    this.platform.tap();
    this.openRule.update((v) => (v === id ? null : id));
  }

  async copyWifi(name: string) {
    try {
      await navigator.clipboard.writeText(name);
      await this.toast.show('Wi-Fi name copied', 'success');
    } catch {
      await this.toast.show(name);
    }
  }

  protected readonly Math = Math;

  waitColor(min: number): string {
    return min <= 10 ? 'var(--gm-mint)' : min <= 20 ? 'var(--gm-amber)' : 'var(--gm-coral)';
  }
}
