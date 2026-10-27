import { computed, inject, Injectable, signal } from '@angular/core';
import { AirportInfo, Expense, Flight, FlightAlert, TravelStats, Trip } from '../models';
import { GatemateApi, NewFlightInput } from './api';
import { Preferences } from '@capacitor/preferences';
import { buildAlerts } from './alerts-engine';
import { AirportDbService, haversineKm } from './airport-db.service';
import { LocationService } from './location.service';

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/** Signal-based cache for trips, alerts, stats and airport data shared across tabs. */
@Injectable({ providedIn: 'root' })
export class TravelStore {
  private api = inject(GatemateApi);
  private db = inject(AirportDbService);
  private location = inject(LocationService);
  /** Server alerts (gate changes, delays, chat) — device reminders are derived from trips below. */
  private serverAlerts = signal<FlightAlert[]>([]);
  private readIds = signal<Set<string>>(new Set());
  private dismissedIds = signal<Set<string>>(new Set());
  private clock = signal(Date.now());

  readonly trips = signal<Trip[]>([]);
  readonly tripsState = signal<LoadState>('idle');
  /** Everything that is due (past or now), newest first. */
  readonly alerts = computed<FlightAlert[]>(() => {
    const now = this.clock();
    this.db.ready();
    const device = buildAlerts(this.trips(), {
      now,
      countryOf: (c) => this.db.get(c)?.country,
      kmToAirport: (c) => {
        const f = this.location.fix(), a = this.db.get(c);
        return f && a ? haversineKm(f.lat, f.lon, a.lat, a.lon) : undefined;
      },
    });
    const read = this.readIds(), gone = this.dismissedIds();
    return [...this.serverAlerts(), ...device]
      .filter((a) => !gone.has(a.id))
      .map((a) => ({ ...a, read: a.read || read.has(a.id) }))
      .sort((x, y) => +new Date(y.createdAt) - +new Date(x.createdAt));
  });
  readonly dueAlerts = computed(() => this.alerts().filter((a) => +new Date(a.createdAt) <= this.clock()));
  readonly upcomingReminders = computed(() =>
    this.alerts().filter((a) => +new Date(a.createdAt) > this.clock()).sort((x, y) => +new Date(x.createdAt) - +new Date(y.createdAt)),
  );
  readonly alertsState = signal<LoadState>('idle');
  readonly stats = signal<TravelStats | null>(null);
  readonly airport = signal<AirportInfo | null>(null);
  readonly airportState = signal<LoadState>('idle');

  readonly upcomingTrips = computed(() =>
    this.trips()
      .filter((t) => new Date(t.endDate).getTime() > Date.now())
      .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate)),
  );
  readonly pastTrips = computed(() =>
    this.trips()
      .filter((t) => new Date(t.endDate).getTime() <= Date.now())
      .sort((a, b) => +new Date(b.startDate) - +new Date(a.startDate)),
  );
  readonly nextFlight = computed<{ flight: Flight; trip: Trip } | null>(() => {
    const now = Date.now();
    let best: { flight: Flight; trip: Trip } | null = null;
    for (const trip of this.trips()) {
      for (const flight of trip.flights) {
        const dep = new Date(flight.departure).getTime();
        if (dep > now - 30 * 60_000 && (!best || dep < new Date(best.flight.departure).getTime())) best = { flight, trip };
      }
    }
    return best;
  });
  readonly unreadAlerts = computed(() => this.dueAlerts().filter((a) => !a.read).length);

  constructor() {
    setInterval(() => this.clock.set(Date.now()), 60_000);
    void Preferences.get({ key: 'gm_alerts_state' })
      .then(({ value }) => {
        if (!value) return;
        const v = JSON.parse(value) as { read: string[]; gone: string[] };
        this.readIds.set(new Set(v.read));
        this.dismissedIds.set(new Set(v.gone));
      })
      .catch(() => {});
  }

  private saveAlertState() {
    const value = JSON.stringify({ read: [...this.readIds()].slice(-300), gone: [...this.dismissedIds()].slice(-300) });
    Preferences.set({ key: 'gm_alerts_state', value }).catch(() => {});
  }

  dismissAlert(id: string) {
    this.dismissedIds.update((s) => new Set(s).add(id));
    this.saveAlertState();
  }

  async loadTrips(force = false): Promise<void> {
    if (!force && this.tripsState() === 'ready') return;
    if (!force) this.tripsState.set('loading');
    try {
      this.trips.set(await this.api.getTrips());
      this.tripsState.set('ready');
    } catch {
      this.tripsState.set('error');
    }
  }

  async loadAlerts(force = false): Promise<void> {
    if (!force && this.alertsState() === 'ready') return;
    if (!force) this.alertsState.set('loading');
    try {
      void this.db.load();
      this.serverAlerts.set((await this.api.getAlerts()).map((a) => ({ ...a, source: 'server' as const })));
      this.alertsState.set('ready');
    } catch {
      this.alertsState.set('error');
    }
  }

  async loadStats(force = false): Promise<void> {
    if (!force && this.stats()) return;
    this.stats.set(await this.api.getStats());
  }

  async loadAirport(code: string, force = false): Promise<void> {
    if (!force && this.airport()?.airport.code === code) return;
    this.airportState.set('loading');
    try {
      this.airport.set(await this.api.getAirportInfo(code));
      this.airportState.set('ready');
    } catch {
      this.airportState.set('error');
    }
  }

  trip(id: string): Trip | undefined {
    return this.trips().find((t) => t.id === id);
  }

  async addFlight(input: NewFlightInput): Promise<Trip> {
    const trip = await this.api.addFlight(input);
    this.trips.update((list) => [...list.filter((t) => t.id !== trip.id), trip]);
    return trip;
  }

  async toggleChecklist(tripId: string, itemId: string): Promise<void> {
    let next = false;
    this.trips.update((list) =>
      list.map((t) =>
        t.id !== tripId ? t : { ...t, checklist: t.checklist.map((c) => (c.id === itemId ? ((next = !c.done), { ...c, done: next }) : c)) },
      ),
    );
    await this.api.toggleChecklistItem(tripId, itemId, next).catch(() => this.toggleChecklistLocal(tripId, itemId));
  }

  private toggleChecklistLocal(tripId: string, itemId: string) {
    this.trips.update((list) =>
      list.map((t) => (t.id !== tripId ? t : { ...t, checklist: t.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c)) })),
    );
  }

  async addExpense(tripId: string, expense: Omit<Expense, 'id' | 'createdAt'>): Promise<void> {
    const created = await this.api.addExpense(tripId, expense);
    this.trips.update((list) => list.map((t) => (t.id === tripId ? { ...t, expenses: [...t.expenses, created] } : t)));
  }

  async markAllAlertsRead(): Promise<void> {
    const due = this.dueAlerts().filter((a) => !a.read);
    if (!due.length) return;
    this.readIds.update((s) => new Set([...s, ...due.map((a) => a.id)]));
    this.saveAlertState();
    this.serverAlerts.update((list) => list.map((a) => ({ ...a, read: true })));
    const serverIds = due.filter((a) => a.source === 'server').map((a) => a.id);
    if (serverIds.length) await this.api.markAlertsRead(serverIds).catch(() => {});
  }

  reset(): void {
    this.trips.set([]);
    this.tripsState.set('idle');
    this.serverAlerts.set([]);
    this.alertsState.set('idle');
    this.stats.set(null);
    this.airport.set(null);
    this.airportState.set('idle');
  }
}
