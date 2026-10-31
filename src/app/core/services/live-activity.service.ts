import { effect, inject, Injectable, signal } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Flight } from '../models';
import { t } from '../i18n/i18n.service';
import { FlightStatusPipe } from '../../shared/pipes/status.pipe';
import { TravelStore } from './travel.store';
import { PrefsService } from './prefs.service';

interface LiveActivityPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  start(o: Record<string, unknown>): Promise<{ id: string; updated: boolean }>;
  end(o: { flightId?: string }): Promise<void>;
}

const LiveActivity = registerPlugin<LiveActivityPlugin>('LiveActivity');

const LEAD_MS = 60 * 3_600_000;
const HIDDEN_KEY = 'gm_la_hidden';

export type LockScreenResult = 'shown' | 'disabled' | 'unsupported' | 'failed';
const AFTER_LANDING_MS = 30 * 60_000;

@Injectable({ providedIn: 'root' })
export class LiveActivityService {
  private store = inject(TravelStore);
  private prefs = inject(PrefsService);
  private status = new FlightStatusPipe();
  private readonly enabled = Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('LiveActivity');
  private last = '';
  private hidden = new Set<string>(readHidden());
  readonly shown = signal<ReadonlySet<string>>(new Set());

  constructor() {
    if (!this.enabled) return;
    effect(() => {
      const next = this.store.nextFlight();
      const on = this.prefs.notifications().liveActivity !== false;
      this.store.clock();
      void this.sync(on ? next?.flight ?? null : null);
    });
  }

  async show(f: Flight): Promise<LockScreenResult> {
    if (!this.enabled) return 'unsupported';
    this.hidden.delete(f.id);
    saveHidden(this.hidden);
    try {
      if (!(await LiveActivity.isAvailable()).available) return 'disabled';
      await LiveActivity.start(this.payload(f));
      this.mark(f.id, true);
      return 'shown';
    } catch {
      return 'failed';
    }
  }

  async hide(f: Flight): Promise<void> {
    this.hidden.add(f.id);
    saveHidden(this.hidden);
    this.mark(f.id, false);
    if (this.enabled) await LiveActivity.end({ flightId: f.id }).catch(() => {});
  }

  isShown(id: string) {
    return this.shown().has(id);
  }

  private mark(id: string, on: boolean) {
    const next = new Set(on ? [id] : [...this.shown()].filter((x) => x !== id));
    this.shown.set(next);
  }

  get supported() {
    return this.enabled;
  }

  private async sync(f: Flight | null) {
    const now = Date.now();
    if (!f || this.hidden.has(f.id)) {
      if (this.last !== 'none') await LiveActivity.end({}).catch(() => {});
      this.last = 'none';
      this.shown.set(new Set());
      return;
    }
    const dep = new Date(f.departure).getTime();
    const arr = new Date(f.arrival).getTime();
    if (now > arr + AFTER_LANDING_MS) {
      await LiveActivity.end({ flightId: f.id }).catch(() => {});
      this.mark(f.id, false);
      this.last = '';
      return;
    }
    if (dep - now > LEAD_MS) return;
    const key = [f.id, f.gate, f.terminal, f.seat, f.status, f.departure, f.arrival, Math.floor(now / 3_600_000)].join('|');
    if (key === this.last) return;
    try {
      if (!(await LiveActivity.isAvailable()).available) return;
      await LiveActivity.start(this.payload(f));
      this.mark(f.id, true);
      this.last = key;
    } catch {
    }
  }

  private payload(f: Flight) {
    const delayed = f.status === 'delayed' && (f.delayMinutes ?? 0) > 0;
    return {
      flightId: f.id,
      flightNumber: f.number,
      airline: f.airline,
      fromCode: f.from.code,
      fromCity: f.from.city,
      toCode: f.to.code,
      toCity: f.to.city,
      departure: f.departure,
      arrival: f.arrival,
      boarding: f.boardingTime || undefined,
      gate: f.gate,
      terminal: f.terminal,
      seat: f.seat,
      delayed,
      status: delayed ? t('Delayed {n} min', { n: f.delayMinutes }) : this.status.transform(f.status),
      labels: {
        departsIn: t('Departs in'),
        landsIn: t('Lands in'),
        boarding: t('Boarding'),
        gate: t('Gate'),
        seat: t('Seat'),
        landed: t('Landed'),
      },
    };
  }
}

function readHidden(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(-20) : [];
  } catch {
    return [];
  }
}

function saveHidden(ids: Set<string>) {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...ids].slice(-20)));
  } catch {
    return;
  }
}
