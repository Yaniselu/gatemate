import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonToolbar } from '@ionic/angular/standalone';
import { AirportDbService, AirportRecord, CountryFacts } from '../../core/services/airport-db.service';
import { DestinationInfo, DestinationService, weatherLabel } from '../../core/services/destination.service';
import { ExploreService, Holiday, Sight } from '../../core/services/explore.service';
import { PrefsService } from '../../core/services/prefs.service';
import { TravelStore } from '../../core/services/travel.store';
import { ToastService } from '../../core/services/toast.service';
import { PlatformService } from '../../core/services/platform.service';
import { AchievementsService } from '../../core/services/achievements.service';
import { PHRASE_KEYS, phrasesFor } from '../../core/data/phrasebook';
import { sunTimes } from '../../core/utils/sun';
import { CityImageComponent } from '../../shared/components/city-image.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { PressableDirective } from '../../shared/directives/pressable.directive';
import { ChecklistItem } from '../../core/models';

type Section = 'sights' | 'when' | 'phrases' | 'money' | 'pack' | 'essentials';
interface PackItem { label: string; why: string; category: ChecklistItem['category'] }

@Component({
  selector: 'gm-explore',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonButtons, IonBackButton, IonContent, IonIcon, FormsModule, DecimalPipe, CityImageComponent, SkeletonComponent, RevealDirective, PressableDirective],
  templateUrl: './explore.page.html',
  styleUrl: './explore.page.scss',
})
export class ExplorePage {
  private db = inject(AirportDbService);
  private dest = inject(DestinationService);
  private explore = inject(ExploreService);
  private prefs = inject(PrefsService);
  private store = inject(TravelStore);
  private toast = inject(ToastService);
  private platform = inject(PlatformService);
  private achievements = inject(AchievementsService);

  /** Route params: /explore/:iata?trip=<id> */
  readonly iata = input.required<string>();
  readonly trip = input<string | undefined>();

  readonly airport = signal<AirportRecord | undefined>(undefined);
  readonly country = signal<CountryFacts | undefined>(undefined);
  readonly info = signal<DestinationInfo | null>(null);
  readonly infoError = signal(false);
  readonly sights = signal<Sight[] | null>(null);
  readonly sightsError = signal(false);
  readonly holidays = signal<Holiday[] | null>(null);
  readonly holidaysError = signal(false);
  readonly section = signal<Section>('sights');
  readonly scrollY = signal(0);
  readonly showAllSights = signal(false);
  private now = signal(Date.now());
  protected wl = weatherLabel;
  protected phraseKeys = PHRASE_KEYS;

  readonly sections: { id: Section; label: string; icon: string }[] = [
    { id: 'sights', label: 'Sights', icon: 'camera-outline' },
    { id: 'when', label: 'Days & holidays', icon: 'calendar-outline' },
    { id: 'phrases', label: 'Phrases', icon: 'chatbubble-ellipses-outline' },
    { id: 'money', label: 'Money', icon: 'cash-outline' },
    { id: 'pack', label: 'Pack', icon: 'bag-handle-outline' },
    { id: 'essentials', label: 'Essentials', icon: 'shield-checkmark-outline' },
  ];

  readonly tripData = computed(() => (this.trip() ? this.store.trip(this.trip()!) : undefined));
  readonly window = computed(() => {
    const t = this.tripData();
    if (t) return { from: new Date(t.startDate), to: new Date(t.endDate) };
    const from = new Date();
    return { from, to: new Date(from.getTime() + 30 * 86_400_000) };
  });

  readonly localTime = computed(() => {
    const a = this.airport();
    return a ? new Date(this.now()).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: a.tz }) : '';
  });

  readonly center = computed(() => {
    const c = this.info()?.summary?.coords;
    const a = this.airport();
    return c ?? (a ? { lat: a.lat, lon: a.lon } : undefined);
  });

  readonly sun = computed(() => {
    const c = this.center(), a = this.airport();
    if (!c || !a) return null;
    const fmt = (d: Date | null) => (d ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: a.tz }) : '—');
    const day = (d: Date) => {
      const s = sunTimes(d, c.lat, c.lon);
      const len = s.sunrise && s.sunset ? (s.sunset.getTime() - s.sunrise.getTime()) / 3_600_000 : s.polar === 'day' ? 24 : 0;
      return { rise: fmt(s.sunrise), set: fmt(s.sunset), hours: len, polar: s.polar };
    };
    return { today: day(new Date(this.now())), trip: this.tripData() ? day(new Date(this.tripData()!.startDate)) : null };
  });

  readonly tripHolidays = computed(() => {
    const list = this.holidays();
    if (!list) return null;
    const { from, to } = this.window();
    const start = iso(from), end = iso(to);
    return list.filter((h) => h.date >= start && h.date <= end);
  });
  readonly nextHolidays = computed(() => {
    const list = this.holidays();
    if (!list) return [];
    const today = iso(new Date());
    return list.filter((h) => h.date >= today).slice(0, 4);
  });

  readonly phrases = computed(() => phrasesFor(this.country()?.languages));
  readonly visibleSights = computed(() => {
    const s = this.sights() ?? [];
    return this.showAllSights() ? s : s.slice(0, 8);
  });

  // ----- Money -----
  readonly homeCurrency = computed(() => {
    const home = this.db.get(this.prefs.homeAirport());
    return (home && this.db.country(home.country)?.currency?.[0]) || 'EUR';
  });
  readonly amount = signal(50);
  readonly reverse = signal(false);
  readonly converted = computed(() => {
    const fx = this.info()?.fx;
    if (!fx) return null;
    return this.reverse() ? this.amount() / fx.rate : this.amount() * fx.rate;
  });
  readonly quick = [10, 50, 100, 500];

  // ----- Packing -----
  readonly packList = computed<PackItem[]>(() => {
    const d = this.info();
    if (!d) return [];
    const items: PackItem[] = [];
    const days = d.weather?.days ?? [];
    const max = days.length ? Math.max(...days.map((x) => x.max)) : undefined;
    const min = days.length ? Math.min(...days.map((x) => x.min)) : undefined;
    const wet = days.some((x) => (x.code >= 51 && x.code <= 67) || (x.code >= 80 && x.code <= 82) || x.code >= 95);
    const snow = days.some((x) => (x.code >= 71 && x.code <= 77) || x.code === 85 || x.code === 86);
    if (wet) items.push({ label: 'Compact umbrella or rain jacket', why: 'Rain in the 5-day forecast', category: 'packing' });
    if (snow) items.push({ label: 'Waterproof shoes & gloves', why: 'Snow in the forecast', category: 'packing' });
    if (min !== undefined && min <= 8) items.push({ label: 'Warm layer or jacket', why: `Lows around ${min}°C`, category: 'packing' });
    if (max !== undefined && max >= 26) items.push({ label: 'Sunscreen (≤100 ml in cabin bag)', why: `Highs up to ${max}°C`, category: 'packing' });
    if (max !== undefined && max >= 26) items.push({ label: 'Sunglasses & hat', why: 'Strong sun', category: 'packing' });
    if (this.needsAdapter()) items.push({ label: `Plug adapter (type ${d.country?.plugs})`, why: 'Different sockets from home', category: 'packing' });
    if (this.otherCurrency()) items.push({ label: `Card without FX fees or some ${d.country?.currency?.[0]}`, why: 'Different currency', category: 'tasks' });
    items.push({ label: 'Offline map of ' + (d.airport.city || 'the city'), why: 'Works without roaming', category: 'tasks' });
    items.push({ label: 'Travel insurance documents', why: 'Keep a copy on your phone', category: 'documents' });
    return items;
  });

  readonly needsAdapter = computed(() => {
    const d = this.info();
    const home = this.db.get(this.prefs.homeAirport());
    const homePlugs = home ? this.db.country(home.country)?.plugs : undefined;
    if (!d?.country?.plugs || !homePlugs) return false;
    const mine = new Set(homePlugs.split('/'));
    return !d.country.plugs.split('/').some((p) => mine.has(p));
  });
  readonly otherCurrency = computed(() => {
    const c = this.info()?.country?.currency?.[0];
    return !!c && c !== this.homeCurrency();
  });

  constructor() {
    effect(() => {
      const code = this.iata().toUpperCase();
      this.info.set(null);
      this.sights.set(null);
      this.holidays.set(null);
      void this.load(code);
    });
    const t = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
    void this.store.loadTrips().catch(() => {});
    void this.achievements.track('guide_opened');
  }

  private async load(code: string) {
    await this.db.load();
    const a = this.db.get(code);
    this.airport.set(a);
    if (!a) {
      this.infoError.set(true);
      return;
    }
    this.country.set(this.db.country(a.country));
    const { from, to } = this.window();
    const years = [...new Set([from.getFullYear(), to.getFullYear()])];
    Promise.all(years.map((y) => this.explore.holidays(a.country, y)))
      .then((r) => this.holidays.set(r.flat().sort((x, y) => x.date.localeCompare(y.date))))
      .catch(() => this.holidaysError.set(true));
    try {
      const info = await this.dest.get(code, this.homeCurrency());
      this.info.set(info);
    } catch {
      this.infoError.set(true);
    }
    const c = this.center();
    if (c) {
      this.explore.sights(code, c.lat, c.lon).then((s) => this.sights.set(s)).catch(() => this.sightsError.set(true));
    }
  }

  onScroll(ev: CustomEvent<{ scrollTop: number }>) {
    this.scrollY.set(ev.detail.scrollTop);
  }

  go(id: Section) {
    this.platform.selection();
    this.section.set(id);
    document.getElementById('ex-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  setAmount(v: number | string) {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    this.amount.set(Number.isFinite(n) && n >= 0 ? Math.min(n, 1e9) : 0);
  }

  flip() {
    this.platform.selection();
    const c = this.converted();
    this.reverse.update((r) => !r);
    if (c !== null) this.amount.set(Math.round(c * 100) / 100);
  }

  speak(text: string) {
    try {
      const lang = { Spanish: 'es', French: 'fr', Portuguese: 'pt', German: 'de', Italian: 'it', Dutch: 'nl', Romanian: 'ro', Catalan: 'ca', Greek: 'el', Turkish: 'tr', Polish: 'pl', Czech: 'cs', Slovak: 'sk', Hungarian: 'hu', Croatian: 'hr', Serbian: 'sr', Bulgarian: 'bg', Swedish: 'sv', Danish: 'da', Norwegian: 'nb', Finnish: 'fi', Russian: 'ru', Ukrainian: 'uk', Arabic: 'ar', Hebrew: 'he', Japanese: 'ja', Korean: 'ko', Chinese: 'zh-CN', Thai: 'th', Vietnamese: 'vi', Indonesian: 'id', Malay: 'ms', Hindi: 'hi', Albanian: 'sq', Swahili: 'sw' }[this.phrases()?.language ?? ''];
      if (!lang || !('speechSynthesis' in window)) {
        void this.toast.show('Audio isn’t available on this device.');
        return;
      }
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.split(' · ')[0].split(' (')[0]);
      u.lang = lang;
      u.rate = 0.85;
      speechSynthesis.speak(u);
      this.platform.tap();
    } catch {
      /* speech not supported */
    }
  }

  async addToChecklist(items: PackItem[]) {
    const t = this.tripData();
    if (!t) return;
    try {
      const n = await this.store.addChecklistItems(t.id, items.map(({ label, category }) => ({ label, category })));
      void this.toast.show(n ? `Added ${n} item${n === 1 ? '' : 's'} to your checklist` : 'Already on your checklist', 'success');
    } catch {
      void this.toast.show('Couldn’t update the checklist. Try again.', 'error');
    }
  }

  mapsUrl(s: Sight) {
    return `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}`;
  }

  holidayDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  currencyName(code?: string) {
    if (!code) return '';
    try {
      return new Intl.DisplayNames(['en'], { type: 'currency' }).of(code) ?? code;
    } catch {
      return code;
    }
  }

  weekday(date: string) {
    return new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' });
  }
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
