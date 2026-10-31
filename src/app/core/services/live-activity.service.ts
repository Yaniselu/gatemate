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

const LEAD_MS = 6 * 3_600_000;
const AFTER_LANDING_MS = 30 * 60_000;

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
    const dep = new Date(f.departure).getTime();
    const arr = new Date(f.arrival).getTime();
    if (now > arr + AFTER_LANDING_MS) {
      await LiveActivity.end({ flightId: f.id }).catch(() => {});
      this.last = '';
      return;
    }
    if (dep - now > LEAD_MS) return;
    const key = [f.id, f.gate, f.terminal, f.seat, f.status, f.departure, f.arrival].join('|');
    if (key === this.last) return;
    try {
      if (!(await LiveActivity.isAvailable()).available) return;
      await LiveActivity.start(this.payload(f));
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
