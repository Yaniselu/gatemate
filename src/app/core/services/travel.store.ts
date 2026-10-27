import { computed, inject, Injectable, signal } from '@angular/core';
import { AirportInfo, Expense, Flight, FlightAlert, TravelStats, Trip } from '../models';
import { GatemateApi, NewFlightInput } from './api';

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/** Signal-based cache for trips, alerts, stats and airport data shared across tabs. */
@Injectable({ providedIn: 'root' })
export class TravelStore {
  private api = inject(GatemateApi);

  readonly trips = signal<Trip[]>([]);
  readonly tripsState = signal<LoadState>('idle');
  readonly alerts = signal<FlightAlert[]>([]);
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
  readonly unreadAlerts = computed(() => this.alerts().filter((a) => !a.read).length);

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
      this.alerts.set(await this.api.getAlerts());
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
    const ids = this.alerts().filter((a) => !a.read).map((a) => a.id);
    if (!ids.length) return;
    this.alerts.update((list) => list.map((a) => ({ ...a, read: true })));
    await this.api.markAlertsRead(ids).catch(() => {});
  }

  reset(): void {
    this.trips.set([]);
    this.tripsState.set('idle');
    this.alerts.set([]);
    this.alertsState.set('idle');
    this.stats.set(null);
    this.airport.set(null);
    this.airportState.set('idle');
  }
}
