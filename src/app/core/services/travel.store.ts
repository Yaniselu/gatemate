import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { ChecklistItem, Expense, Flight, FlightAlert, TravelStats, Trip } from '../models';
import { GatemateApi, NewFlightInput } from './api';
import { Preferences } from '@capacitor/preferences';
import { buildAlerts } from './alerts-engine';
import { AirportDbService, haversineKm } from './airport-db.service';
import { LocationService } from './location.service';
import { AuthService, TRIPS_CACHE_KEY } from './auth.service';
import { NetworkService } from './network.service';
import { GatesService } from './gates.service';
import { SecureStorageService } from '../security/secure-storage.service';

interface TripsCache {
  userId: string;
  savedAt: number;
  trips: Trip[];
}

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/** Signal-based cache for trips, alerts, stats and airport data shared across tabs. */
@Injectable({ providedIn: 'root' })
export class TravelStore {
  private api = inject(GatemateApi);
  private db = inject(AirportDbService);
  private location = inject(LocationService);
  private auth = inject(AuthService);
  private storage = inject(SecureStorageService);
  private network = inject(NetworkService);
  private gates = inject(GatesService);
  private prefetched = new Set<string>();
  private inflight: Promise<void> | null = null;
  private persistTimer?: ReturnType<typeof setTimeout>;
  /** Server alerts (gate changes, delays, chat) — device reminders are derived from trips below. */
  private serverAlerts = signal<FlightAlert[]>([]);
  private readIds = signal<Set<string>>(new Set());
  private dismissedIds = signal<Set<string>>(new Set());
  private clock = signal(Date.now());

  readonly trips = signal<Trip[]>([]);
  readonly tripsState = signal<LoadState>('idle');
  /** Set while the trips on screen are the copy saved on this phone (offline or server unreachable). */
  readonly savedAt = signal<number | null>(null);
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

    // A different account signing in must never see the previous one's trips.
    let lastUser: string | undefined;
    effect(() => {
      const id = this.auth.user()?.id;
      if (lastUser && id !== lastUser) untracked(() => this.reset());
      lastUser = id;
    });

    // Keep an encrypted copy on the device so boarding passes and plans work in flight mode.
    effect(() => {
      const trips = this.trips();
      const userId = this.auth.user()?.id;
      if (!userId || untracked(this.tripsState) !== 'ready' || untracked(this.savedAt)) return;
      clearTimeout(this.persistTimer);
      this.persistTimer = setTimeout(() => {
        const value: TripsCache = { userId, savedAt: Date.now(), trips };
        void this.storage.set(TRIPS_CACHE_KEY, JSON.stringify(value)).catch(() => {});
      }, 800);
    });

    // Live updates: while a flight is within a day and a half, re-check gates, delays and alerts every minute
    // (only when the app is on screen and online), and straight away when the app comes back to the foreground.
    setInterval(() => {
      if (!this.liveWindow() || document.visibilityState !== 'visible') return;
      void this.refreshLive();
    }, 60_000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.auth.status() === 'signed-in') void this.refreshLive();
    });

    // Back online: replace the saved copy with fresh data.
    let wasOnline = true;
    effect(() => {
      const online = this.network.online();
      if (online && !wasOnline && this.auth.status() === 'signed-in') untracked(() => void this.loadTrips(true));
      wasOnline = online;
    });
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
    if (this.inflight) return this.inflight;
    if (!force && this.tripsState() === 'ready' && !this.savedAt()) return;
    this.inflight = (async () => {
      if (this.tripsState() === 'idle') await this.restoreCache();
      if (this.tripsState() !== 'ready') this.tripsState.set('loading');
      try {
        const trips = await this.api.getTrips();
        this.savedAt.set(null);
        this.trips.set(trips);
        this.tripsState.set('ready');
        setTimeout(() => void this.prefetchAirports(), 3000);
      } catch {
        // Keep showing the saved copy rather than an error screen.
        if (!this.savedAt()) this.tripsState.set('error');
      } finally {
        this.inflight = null;
      }
    })();
    return this.inflight;
  }

  /** Last time trips and alerts were refreshed from the server. */
  readonly syncedAt = signal<number | null>(null);

  private liveWindow(): boolean {
    const n = this.nextFlight();
    if (!n || this.auth.status() !== 'signed-in' || !this.network.online()) return false;
    const dep = +new Date(n.flight.departure);
    return dep - Date.now() < 36 * 3600_000 && Date.now() < +new Date(n.flight.arrival) + 2 * 3600_000;
  }

  private lastLive = 0;
  async refreshLive(): Promise<void> {
    if (Date.now() - this.lastLive < 20_000 || !this.network.online()) return;
    this.lastLive = Date.now();
    await Promise.all([this.loadTrips(true), this.loadAlerts(true)]).catch(() => {});
    this.syncedAt.set(Date.now());
  }

  /**
   * Downloads the plans of the airports on upcoming trips in the background, so the airport map opens instantly
   * (and works offline) on the day. One airport at a time, each at most once per session.
   */
  private async prefetchAirports(): Promise<void> {
    const codes = this.upcomingTrips()
      .flatMap((t) => t.flights)
      .filter((f) => +new Date(f.departure) - Date.now() < 30 * 86_400_000)
      .flatMap((f) => [f.from.code, f.to.code])
      .filter((c, i, a) => a.indexOf(c) === i && !this.prefetched.has(c))
      .slice(0, 4);
    if (!codes.length || !this.network.online()) return;
    await this.db.load().catch(() => {});
    for (const c of codes) {
      this.prefetched.add(c);
      const a = this.db.get(c);
      if (a) await this.gates.get(a).catch(() => this.prefetched.delete(c));
    }
  }

  private async restoreCache(): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    try {
      const raw = await this.storage.get(TRIPS_CACHE_KEY);
      const c = raw ? (JSON.parse(raw) as TripsCache) : null;
      if (!c || c.userId !== userId || !Array.isArray(c.trips)) return;
      this.savedAt.set(c.savedAt);
      this.trips.set(c.trips);
      this.tripsState.set('ready');
    } catch {
      /* unreadable cache: fetch from the server */
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

  /** Adds items that aren't on the list yet (case-insensitive); returns how many were added. */
  async addChecklistItems(tripId: string, items: { label: string; category: ChecklistItem['category'] }[]): Promise<number> {
    const trip = this.trip(tripId);
    if (!trip) return 0;
    const have = new Set(trip.checklist.map((c) => c.label.toLowerCase()));
    let added = 0;
    for (const it of items) {
      if (have.has(it.label.toLowerCase())) continue;
      const created = await this.api.addChecklistItem(tripId, it.label, it.category);
      have.add(it.label.toLowerCase());
      this.trips.update((list) => list.map((t) => (t.id === tripId ? { ...t, checklist: [...t.checklist, created] } : t)));
      added++;
    }
    return added;
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
    clearTimeout(this.persistTimer);
    this.savedAt.set(null);
    this.trips.set([]);
    this.tripsState.set('idle');
    this.serverAlerts.set([]);
    this.alertsState.set('idle');
    this.stats.set(null);
  }
}
