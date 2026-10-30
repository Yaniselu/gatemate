import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { Flight } from '../../core/models';
import { TranslatePipe } from '../../core/i18n/i18n.service';

/** Standard-atmosphere pressure (hPa) at an altitude in feet. */
export function pressureAt(ft: number) {
  return 1013.25 * Math.pow(1 - 2.25577e-5 * ft * 0.3048, 5.25588);
}

/** Outside air temperature (°C) in the standard atmosphere, constant above the tropopause. */
export function outsideTempAt(ft: number) {
  return Math.max(-56.5, 15 - 1.98 * (ft / 1000));
}

export interface CabinPoint {
  /** Minutes after departure. */
  t: number;
  planeFt: number;
  cabinFt: number;
  pressure: number;
  humidity: number;
}

/**
 * How the cabin air typically evolves over a flight: the plane climbs for ~20 min to cruise and descends over the
 * last ~25 min; the cabin is pressurised to an equivalent of up to 8,000 ft (6,000 ft on the 787 and A350) and the
 * air gets drier the longer you're up, settling around 10–15 % humidity.
 */
export function cabinProfile(durationMin: number, aircraft?: string, step = 2): CabinPoint[] {
  const modern = /787|A35|A350/i.test(aircraft ?? '');
  const maxCabin = modern ? 6000 : 8000;
  const cruise = durationMin < 75 ? 28000 : durationMin < 150 ? 36000 : 38000;
  const climb = Math.min(22, durationMin * 0.3), descent = Math.min(28, durationMin * 0.35);
  const out: CabinPoint[] = [];
  for (let t = 0; t <= durationMin; t += step) out.push(point(t));
  if (out[out.length - 1].t !== durationMin) out.push(point(durationMin));
  return out;

  function point(t: number): CabinPoint {
    const up = Math.min(1, t / climb), down = Math.min(1, Math.max(0, (durationMin - t) / descent));
    const k = Math.min(up, down);
    const planeFt = cruise * Math.sin((k * Math.PI) / 2);
    // Cabin altitude follows the plane at a gentle rate, capped by the pressurisation schedule.
    const cabinFt = Math.min(maxCabin, planeFt * (maxCabin / cruise) * 1.05);
    const humidity = 12 + 33 * Math.exp(-t / 55);
    return { t, planeFt, cabinFt, pressure: pressureAt(cabinFt), humidity };
  }
}

/** Estimated cabin pressure, equivalent altitude and humidity for this flight, with "now" when you're on board. */
@Component({
  selector: 'gm-cabin-air',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, TranslatePipe, DecimalPipe],
  template: `
    <section class="card">
      <header>
        <span class="ic"><ion-icon name="cloud-outline" /></span>
        <div><b>{{ 'Cabin air' | t }}</b><small>{{ (now() === null ? 'What to expect on board' : 'Estimated right now') | t }}</small></div>
      </header>

      <div class="stats">
        <div><small>{{ 'Cabin pressure' | t }}</small><b>{{ shown().pressure | number: '1.0-0' }} <i>hPa</i></b><em>{{ 'like being at {ft} ft' | t: { ft: fmtFt(shown().cabinFt) } }}</em></div>
        <div><small>{{ 'Humidity' | t }}</small><b>{{ shown().humidity | number: '1.0-0' }} <i>%</i></b><em>{{ (shown().humidity < 20 ? 'Drier than a desert' : 'Comfortable') | t }}</em></div>
        <div><small>{{ 'Outside' | t }}</small><b>{{ outside() | number: '1.0-0' }} <i>°C</i></b><em>{{ fmtFt(shown().planeFt) }} ft</em></div>
      </div>

      <svg viewBox="0 0 320 96" preserveAspectRatio="none" class="chart" aria-hidden="true">
        <defs>
          <linearGradient id="ca-p" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#22c7d3" stop-opacity=".35" /><stop offset="1" stop-color="#22c7d3" stop-opacity="0" /></linearGradient>
        </defs>
        <path [attr.d]="pressureArea()" fill="url(#ca-p)" />
        <path [attr.d]="pressureLine()" fill="none" stroke="#0fb5c3" stroke-width="2.2" />
        <path [attr.d]="humidityLine()" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-dasharray="5 4" />
        @if (now() !== null) {
          <line [attr.x1]="x(now()!)" [attr.x2]="x(now()!)" y1="4" y2="92" stroke="#0f172a" stroke-width="1.2" stroke-dasharray="2 3" />
          <circle [attr.cx]="x(now()!)" [attr.cy]="pressureY(shown().pressure)" r="4.5" fill="#0fb5c3" stroke="#fff" stroke-width="2" />
        }
      </svg>
      <div class="legend">
        <span><i class="p"></i>{{ 'Cabin pressure' | t }}</span>
        <span><i class="h"></i>{{ 'Humidity' | t }}</span>
        <span class="axis">{{ 'Take-off' | t }} → {{ 'Landing' | t }}</span>
      </div>

      <ul class="tips">
        <li><ion-icon name="water-outline" />{{ 'Drink about a glass of water an hour; skip extra coffee and alcohol.' | t }}</li>
        <li><ion-icon name="ear-outline" />{{ 'Ears blocked on descent? Swallow, yawn or chew gum.' | t }}</li>
        <li><ion-icon name="eye-outline" />{{ 'Dry eyes or contacts: eye drops and lip balm help.' | t }}</li>
      </ul>
      <p class="fine">{{ 'Estimate from the standard atmosphere and typical pressurisation, not a measurement.' | t }}</p>
    </section>
  `,
  styles: `
    :host { display: block; margin-bottom: 14px; }
    .card { padding: 16px; border-radius: 24px; background: var(--gm-card-bg, #fff); border: 1px solid var(--gm-card-border, #e6eaef); box-shadow: 0 10px 30px rgba(15,23,42,.06); }
    header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    header b { display: block; font-size: 16px; font-weight: 800; }
    header small { font-size: 12px; color: var(--gm-ink-3); }
    .ic { width: 34px; height: 34px; border-radius: 11px; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #6366f1; background: rgba(99,102,241,.12); }
    .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .stats div { padding: 10px; border-radius: 16px; background: var(--gm-surface); min-width: 0; }
    .stats small { display: block; font-size: 10.5px; font-weight: 750; letter-spacing: .04em; text-transform: uppercase; color: var(--gm-ink-3); }
    .stats b { display: block; margin-top: 3px; font-size: 20px; font-weight: 850; color: var(--gm-ink); font-variant-numeric: tabular-nums; }
    .stats b i { font-style: normal; font-size: 12px; font-weight: 700; color: var(--gm-ink-3); }
    .stats em { display: block; margin-top: 2px; font-style: normal; font-size: 11.5px; line-height: 1.3; color: var(--gm-ink-2); }
    .chart { width: 100%; height: 96px; margin-top: 12px; }
    .legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: 11.5px; font-weight: 650; color: var(--gm-ink-2); }
    .legend i { display: inline-block; width: 14px; height: 3px; margin-right: 5px; vertical-align: middle; border-radius: 2px; }
    .legend .p { background: #0fb5c3; }
    .legend .h { background: repeating-linear-gradient(90deg, #8b5cf6 0 5px, transparent 5px 8px); }
    .legend .axis { margin-left: auto; color: var(--gm-ink-3); }
    .tips { margin: 12px 0 0; padding: 0; list-style: none; }
    .tips li { display: flex; gap: 8px; padding: 4px 0; font-size: 13.5px; line-height: 1.4; color: var(--gm-ink-2); }
    .tips ion-icon { flex: none; margin-top: 2px; font-size: 16px; color: #0fb5c3; }
    .fine { margin: 8px 0 0; font-size: 11.5px; color: var(--gm-ink-3); }
  `,
})
export class CabinAirComponent {
  readonly flight = input.required<Flight>();
  /** Live altitude from tracking, when there is one. */
  readonly liveAltitudeFt = input<number | null>(null);
  private tick = signal(Date.now());

  readonly profile = computed(() => cabinProfile(this.flight().durationMinutes, this.flight().aircraft));
  /** Minutes since departure while airborne, else null. */
  readonly now = computed(() => {
    const f = this.flight(), dep = new Date(f.departure).getTime() + (f.delayMinutes ?? 0) * 60_000;
    const m = (this.tick() - dep) / 60_000;
    return m >= 0 && m <= f.durationMinutes ? m : null;
  });
  readonly shown = computed<CabinPoint>(() => {
    const p = this.profile(), n = this.now();
    if (n === null) return p.reduce((a, b) => (b.cabinFt > a.cabinFt || (b.cabinFt === a.cabinFt && b.humidity < a.humidity) ? b : a));
    const at = p.reduce((a, b) => (Math.abs(b.t - n) < Math.abs(a.t - n) ? b : a));
    const live = this.liveAltitudeFt();
    if (live === null) return at;
    // Real altitude from tracking: derive the cabin from it.
    const cabinFt = Math.min(/787|A35/i.test(this.flight().aircraft ?? '') ? 6000 : 8000, live * 0.22);
    return { ...at, planeFt: live, cabinFt, pressure: pressureAt(cabinFt) };
  });
  readonly outside = computed(() => outsideTempAt(this.shown().planeFt));

  readonly pressureLine = computed(() => this.path((p) => this.pressureY(p.pressure)));
  readonly pressureArea = computed(() => `${this.pressureLine()} L ${this.x(this.flight().durationMinutes)} 96 L 0 96 Z`);
  readonly humidityLine = computed(() => this.path((p) => 92 - ((p.humidity - 5) / 45) * 84));

  constructor() {
    const id = setInterval(() => this.tick.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  x(t: number) {
    return (t / Math.max(1, this.flight().durationMinutes)) * 320;
  }

  /** Low pressure is drawn high, so the curve looks like the flight profile. */
  pressureY(p: number) {
    return 8 + ((p - 740) / (1020 - 740)) * 84;
  }

  fmtFt(ft: number) {
    return Math.round(ft / 100) * 100;
  }

  private path(y: (p: CabinPoint) => number) {
    return this.profile().map((p, i) => `${i ? 'L' : 'M'} ${this.x(p.t).toFixed(1)} ${y(p).toFixed(1)}`).join(' ');
  }
}
