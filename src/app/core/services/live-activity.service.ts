import { effect, inject, Injectable } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Flight } from '../models';
import { t } from '../i18n/i18n.service';
import { FlightStatusPipe } from '../../shared/pipes/status.pipe';
import { TravelStore } from './travel.store';

interface LiveActivityPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  start(o: Record<string, unknown>): Promise<{ id: string; updated: boolean }>;
  end(o: { flightId?: string }): Promise<void>;
}

const LiveActivity = registerPlugin<LiveActivityPlugin>('LiveActivity');

/** Show the flight this many hours before departure; iOS keeps an activity up to 8 h (12 h on the lock screen). */
const LEAD_MS = 6 * 3_600_000;
const AFTER_LANDING_MS = 30 * 60_000;

/**
 * Keeps the next flight on the iPhone lock screen, in the Dynamic Island and on Apple Watch (Smart Stack):
 * countdown to departure, then to landing, with gate, seat and status. Started a few hours before the flight,
 * updated when the gate or status changes, ended after landing. iOS only; nothing happens elsewhere.
 */
@Injectable({ providedIn: 'root' })
export class LiveActivityService {
  private store = inject(TravelStore);
  private status = new FlightStatusPipe();
  private readonly enabled = Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('LiveActivity');
  private last = '';

  constructor() {
    if (!this.enabled) return;
    effect(() => {
      const next = this.store.nextFlight();
      this.store.clock();
      void this.sync(next?.flight ?? null);
    });
  }

  /** Puts a flight on the lock screen now (the "Show on lock screen" button). */
  async show(f: Flight): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      if (!(await LiveActivity.isAvailable()).available) return false;
      await LiveActivity.start(this.payload(f));
      return true;
    } catch {
      return false;
    }
  }

  get supported() {
    return this.enabled;
  }

  private async sync(f: Flight | null) {
    const now = Date.now();
    if (!f) {
      if (this.last) await LiveActivity.end({}).catch(() => {});
      this.last = '';
      return;
    }
    const dep = new Date(f.departure).getTime() + (f.delayMinutes ?? 0) * 60_000;
    const arr = new Date(f.arrival).getTime() + (f.delayMinutes ?? 0) * 60_000;
    if (now > arr + AFTER_LANDING_MS) {
      await LiveActivity.end({ flightId: f.id }).catch(() => {});
      this.last = '';
      return;
    }
    if (dep - now > LEAD_MS) return;
    // Only call into iOS when something the activity shows has changed.
    const key = [f.id, f.gate, f.terminal, f.seat, f.status, f.delayMinutes ?? 0].join('|');
    if (key === this.last) return;
    try {
      if (!(await LiveActivity.isAvailable()).available) return;
      await LiveActivity.start(this.payload(f));
      this.last = key;
    } catch {
      // Live Activities turned off in Settings, or the system said no: the app works the same without it.
    }
  }

  private payload(f: Flight) {
    const shift = (iso: string) => new Date(new Date(iso).getTime() + (f.delayMinutes ?? 0) * 60_000).toISOString();
    const delayed = f.status === 'delayed' && (f.delayMinutes ?? 0) > 0;
    return {
      flightId: f.id,
      flightNumber: f.number,
      airline: f.airline,
      fromCode: f.from.code,
      fromCity: f.from.city,
      toCode: f.to.code,
      toCity: f.to.city,
      departure: shift(f.departure),
      arrival: shift(f.arrival),
      boarding: f.boardingTime ? shift(f.boardingTime) : undefined,
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
