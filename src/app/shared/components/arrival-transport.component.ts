import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { Preferences } from '@capacitor/preferences';
import { Flight } from '../../core/models';
import { AirportDbService, AirportRecord } from '../../core/services/airport-db.service';
import { GatesService, MapFeature } from '../../core/services/gates.service';
import { locale, TranslatePipe } from '../../core/i18n/i18n.service';
import { publicFetch } from '../../core/utils/public-fetch';

interface Place {
  name: string;
  lat: number;
  lon: number;
}

/** Typical ride-hailing (UberX / Bolt) prices in € and a single public-transport ticket, by country. */
const PRICES: Record<string, { base: number; km: number; min: number; floor: number; ticket: number }> = {
  RO: { base: 1.0, km: 0.45, min: 0.1, floor: 3, ticket: 0.7 },
  ES: { base: 2.5, km: 1.1, min: 0.2, floor: 7, ticket: 2.5 },
  IT: { base: 3.0, km: 1.2, min: 0.25, floor: 8, ticket: 2.2 },
  FR: { base: 2.5, km: 1.1, min: 0.3, floor: 8, ticket: 2.2 },
  DE: { base: 3.5, km: 1.8, min: 0.3, floor: 9, ticket: 3.5 },
  GB: { base: 3.0, km: 1.4, min: 0.25, floor: 7, ticket: 3.5 },
  PT: { base: 1.5, km: 0.7, min: 0.12, floor: 4, ticket: 1.9 },
  GR: { base: 2.0, km: 0.9, min: 0.15, floor: 5, ticket: 1.5 },
  BE: { base: 3.0, km: 1.5, min: 0.25, floor: 8, ticket: 2.6 },
  NL: { base: 3.0, km: 1.5, min: 0.25, floor: 8, ticket: 3.4 },
};
const DEFAULT_PRICE = { base: 2.5, km: 1.1, min: 0.2, floor: 6, ticket: 2.5 };

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * After landing: where ride-hailing and public transport leave from, deep links to Uber, Bolt and transit
 * directions, and, with the accommodation entered, which one is worth it (time, cost per person, night arrival).
 */
@Component({
  selector: 'gm-arrival-transport',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, TranslatePipe, FormsModule, DecimalPipe],
  template: `
    <section class="card">
      <header>
        <span class="ic"><ion-icon name="car-outline" /></span>
        <div><b>{{ 'When you land in {city}' | t: { city: flight().to.city } }}</b><small>{{ 'Getting from the airport to where you stay' | t }}</small></div>
      </header>

      <label class="stay">
        <ion-icon name="bed-outline" />
        <input type="search" [placeholder]="'Where are you staying? Hotel or address' | t" [ngModel]="query()" (ngModelChange)="search($event)"
               [attr.aria-label]="'Where are you staying?' | t" enterkeyhint="search" />
        @if (stay()) { <button class="x" (click)="clearStay()" [attr.aria-label]="'Clear' | t"><ion-icon name="close-circle" /></button> }
      </label>
      @if (results().length) {
        <div class="results">
          @for (r of results(); track r.lat + ',' + r.lon) {
            <button (click)="choose(r)"><ion-icon name="location-outline" /><span>{{ r.name }}</span></button>
          }
        </div>
      }

      @if (plan(); as p) {
        <div class="verdict" [class.ride]="p.best === 'ride'">
          <ion-icon [name]="p.best === 'ride' ? 'car-sport' : 'bus'" />
          <div>
            <b>{{ (p.best === 'ride' ? 'Take an Uber or Bolt' : 'Take public transport') | t }}</b>
            <small>{{ p.reason | t: p.reasonArgs }}</small>
          </div>
        </div>
        <div class="options">
          <div class="opt" [class.best]="p.best === 'ride'">
            <span class="o-h"><ion-icon name="car-outline" />Uber / Bolt</span>
            <b>≈ {{ p.rideMin }} min</b>
            <small>≈ €{{ p.rideCost | number: '1.0-0' }}@if (people() > 1) { · €{{ p.ridePer | number: '1.0-0' }} {{ 'each' | t }} }</small>
          </div>
          <div class="opt" [class.best]="p.best === 'transit'">
            <span class="o-h"><ion-icon name="bus-outline" />{{ 'Public transport' | t }}</span>
            <b>≈ {{ p.transitMin }} min</b>
            <small>≈ €{{ p.transitCost | number: '1.0-2' }} {{ 'each' | t }}@if (p.night) { · {{ 'may not run at night' | t }} }</small>
          </div>
        </div>
        <p class="dist">{{ '{km} km from the airport · arriving {time}' | t: { km: (p.km | number: '1.0-1'), time: arrivalClock() } }}</p>
      }

      <div class="links">
        <a class="btn uber" [href]="uberLink()" target="_blank" rel="noopener"><ion-icon name="car" />Uber</a>
        <a class="btn bolt" [href]="boltLink()" target="_blank" rel="noopener"><ion-icon name="flash" />Bolt</a>
        <a class="btn transit" [href]="transitLink()" target="_blank" rel="noopener"><ion-icon name="navigate" />{{ 'Transit route' | t }}</a>
      </div>

      <h4>{{ 'Where to find them' | t }}</h4>
      <ul class="tips">
        <li><ion-icon name="car-outline" />{{ 'Ride-hailing: book once you have your bags; the app shows the exact pick-up point, usually a marked zone outside Arrivals or in the short-stay car park, not the taxi rank.' | t }}</li>
        <li><ion-icon name="shield-checkmark-outline" />{{ 'Check the plate and driver’s name in the app before you get in. Ignore drivers offering rides inside the terminal.' | t }}</li>
        @for (s of stops(); track s.id) {
          <li><ion-icon name="bus-outline" /><span><b>{{ s.ref }}</b></span></li>
        }
        <li><ion-icon name="bus-outline" />{{ 'Public transport: follow the bus, train or metro signs from Arrivals; buy the ticket at the machine or with a contactless card where it’s accepted.' | t }}</li>
      </ul>
      <p class="fine">{{ 'Prices and times are estimates from typical fares and straight-line distance; the apps show the real price before you book.' | t }}</p>
    </section>
  `,
  styles: `
    :host { display: block; margin-bottom: 14px; }
    .card { padding: 16px; border-radius: 24px; background: var(--gm-card-bg, #fff); border: 1px solid var(--gm-card-border, #e6eaef); box-shadow: 0 10px 30px rgba(15,23,42,.06); }
    header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    header b { display: block; font-size: 16px; font-weight: 800; }
    header small { font-size: 12px; color: var(--gm-ink-3); }
    .ic { width: 34px; height: 34px; border-radius: 11px; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #f97316; background: rgba(249,115,22,.12); }
    .stay { display: flex; align-items: center; gap: 8px; height: 46px; padding: 0 12px; border-radius: 14px; background: var(--gm-surface); }
    .stay ion-icon { flex: none; font-size: 18px; color: var(--gm-ink-3); }
    .stay input { flex: 1; min-width: 0; border: 0; outline: none; background: none; font-size: 15.5px; color: var(--gm-ink); }
    .stay .x { display: flex; background: none; padding: 4px; }
    .results { margin-top: 6px; border-radius: 14px; overflow: hidden; border: 1px solid var(--gm-card-border, #e6eaef); }
    .results button { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 12px; text-align: left; font-size: 13.5px; color: var(--gm-ink); background: var(--gm-card-bg, #fff); }
    .results button + button { border-top: 1px solid var(--gm-card-border, #e6eaef); }
    .results span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .verdict { display: flex; align-items: center; gap: 12px; margin-top: 12px; padding: 12px 14px; border-radius: 16px; color: #0f5132; background: rgba(16,185,129,.12); }
    .verdict.ride { color: #7c2d12; background: rgba(249,115,22,.12); }
    .verdict ion-icon { flex: none; font-size: 26px; }
    .verdict b { display: block; font-size: 15px; }
    .verdict small { display: block; font-size: 12.5px; line-height: 1.35; opacity: .9; }
    .options { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
    .opt { padding: 10px 12px; border-radius: 16px; background: var(--gm-surface); border: 2px solid transparent; }
    .opt.best { border-color: #0fb5c3; background: rgba(15,181,195,.08); }
    .o-h { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 750; color: var(--gm-ink-2); }
    .opt b { display: block; margin-top: 4px; font-size: 19px; font-weight: 850; }
    .opt small { font-size: 12px; color: var(--gm-ink-2); }
    .dist { margin: 8px 2px 0; font-size: 12px; color: var(--gm-ink-3); }
    .links { display: flex; gap: 8px; margin-top: 12px; }
    .btn { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 42px; border-radius: 14px; font-size: 13.5px; font-weight: 750; text-decoration: none; color: #fff; }
    .btn.uber { background: #0f0f0f; }
    .btn.bolt { background: #2a9d5c; }
    .btn.transit { background: #2563eb; }
    h4 { margin: 16px 0 6px; font-size: 13px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--gm-ink-3); }
    .tips { margin: 0; padding: 0; list-style: none; }
    .tips li { display: flex; gap: 8px; padding: 5px 0; font-size: 13.5px; line-height: 1.4; color: var(--gm-ink-2); }
    .tips ion-icon { flex: none; margin-top: 2px; font-size: 16px; color: #0fb5c3; }
    .fine { margin: 8px 0 0; font-size: 11.5px; color: var(--gm-ink-3); }
  `,
})
export class ArrivalTransportComponent implements OnInit {
  readonly flight = input.required<Flight>();
  readonly tripId = input.required<string>();
  /** Travellers on the trip, to split a ride. */
  readonly people = input(1);
  private db = inject(AirportDbService);
  private gates = inject(GatesService);

  readonly airport = signal<AirportRecord | null>(null);
  readonly stay = signal<Place | null>(null);
  readonly query = signal('');
  readonly results = signal<Place[]>([]);
  readonly stops = signal<MapFeature[]>([]);
  private timer?: ReturnType<typeof setTimeout>;

  readonly arrival = computed(() => new Date(new Date(this.flight().arrival).getTime() + (this.flight().delayMinutes ?? 0) * 60_000));
  readonly arrivalClock = computed(() => {
    try {
      return this.arrival().toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', timeZone: this.flight().to.timezone });
    } catch {
      return this.arrival().toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
    }
  });

  readonly plan = computed(() => {
    const a = this.airport(), s = this.stay();
    if (!a || !s) return null;
    const d = km(a, s) * 1.3; // roads aren't straight
    const price = PRICES[a.country] ?? DEFAULT_PRICE;
    const rideMin = Math.round(d / 32 * 60 + 8);
    const rideCost = Math.max(price.floor, price.base + price.km * d + price.min * rideMin);
    const n = Math.max(1, Math.min(4, this.people()));
    const ridePer = rideCost / n;
    const transitMin = Math.round(d / 20 * 60 + 18);
    const transitCost = price.ticket * (d > 25 ? 2 : 1);
    let hour = this.arrival().getUTCHours();
    try {
      hour = +new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: this.flight().to.timezone }).format(this.arrival()) % 24;
    } catch { /* keep UTC */ }
    const night = hour >= 0 && hour < 5;
    const saved = transitMin - rideMin;
    let best: 'ride' | 'transit' = 'transit';
    let reason = 'Much cheaper, and not much slower.';
    let reasonArgs: Record<string, string | number> = {};
    if (night) {
      best = 'ride';
      reason = 'You land at night, when buses and metro may not run.';
    } else if (ridePer <= transitCost * 1.6 + 1) {
      best = 'ride';
      reason = 'Split between {n}, it costs about the same as the ticket and is faster.';
      reasonArgs = { n };
    } else if (saved >= 30 && ridePer - transitCost <= 20) {
      best = 'ride';
      reason = 'Saves about {min} minutes for around €{eur} more each.';
      reasonArgs = { min: saved, eur: Math.round(ridePer - transitCost) };
    } else {
      reasonArgs = { eur: Math.round(ridePer - transitCost) };
      reason = 'Saves about €{eur} each for a slightly longer trip.';
    }
    return { km: d, rideMin, rideCost, ridePer, transitMin, transitCost, night, best, reason, reasonArgs };
  });

  readonly uberLink = computed(() => {
    const a = this.airport(), s = this.stay();
    if (!a) return 'https://m.uber.com/ul/';
    const q = new URLSearchParams({ action: 'setPickup', 'pickup[latitude]': String(a.lat), 'pickup[longitude]': String(a.lon), 'pickup[nickname]': a.name });
    if (s) {
      q.set('dropoff[latitude]', String(s.lat));
      q.set('dropoff[longitude]', String(s.lon));
      q.set('dropoff[nickname]', s.name);
    }
    return `https://m.uber.com/ul/?${q.toString()}`;
  });
  readonly boltLink = computed(() => {
    const a = this.airport(), s = this.stay();
    if (!a) return 'https://bolt.eu/';
    return s
      ? `bolt://ride?pickup_lat=${a.lat}&pickup_lng=${a.lon}&destination_lat=${s.lat}&destination_lng=${s.lon}`
      : 'https://bolt.eu/';
  });
  readonly transitLink = computed(() => {
    const a = this.airport(), s = this.stay();
    const origin = a ? `${a.lat},${a.lon}` : this.flight().to.name;
    const dest = s ? `${s.lat},${s.lon}` : this.flight().to.city;
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&travelmode=transit`;
  });

  async ngOnInit() {
    try {
      await this.db.load();
      const a = this.db.get(this.flight().to.code) ?? null;
      this.airport.set(a);
      const saved = (await Preferences.get({ key: this.key() })).value;
      if (saved) {
        const p = JSON.parse(saved) as Place;
        this.stay.set(p);
        this.query.set(p.name);
      }
      // Bus stops and stations mapped at the airport (from the airport plan, if it's already loaded or cached).
      if (a) {
        void this.gates.get(a).then((f) => this.stops.set(f.filter((x) => x.kind === 'poi' && x.poi === 'transport' && x.ref && !/taxi|rental|închirieri/i.test(x.ref)).slice(0, 4))).catch(() => {});
      }
    } catch {
      /* offline: the links still work */
    }
  }

  search(q: string) {
    this.query.set(q);
    clearTimeout(this.timer);
    if (q.trim().length < 3) {
      this.results.set([]);
      return;
    }
    this.timer = setTimeout(() => void this.lookup(q.trim()), 350);
  }

  private async lookup(q: string) {
    const a = this.airport();
    const bias = a ? `&lat=${a.lat}&lon=${a.lon}` : '';
    try {
      const res = await publicFetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5${bias}`);
      const data = JSON.parse(res.text) as { features: { geometry: { coordinates: [number, number] }; properties: Record<string, string> }[] };
      this.results.set(data.features.map((f) => {
        const p = f.properties;
        const name = [p['name'], p['street'] && (p['street'] + (p['housenumber'] ? ' ' + p['housenumber'] : '')), p['city']].filter(Boolean).join(', ');
        return { name: name || q, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
      }));
    } catch {
      this.results.set([]);
    }
  }

  async choose(p: Place) {
    this.stay.set(p);
    this.query.set(p.name);
    this.results.set([]);
    await Preferences.set({ key: this.key(), value: JSON.stringify(p) });
  }

  async clearStay() {
    this.stay.set(null);
    this.query.set('');
    await Preferences.remove({ key: this.key() });
  }

  private key() {
    return `gm_stay_${this.tripId()}`;
  }
}

