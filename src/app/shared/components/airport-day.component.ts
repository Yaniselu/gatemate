import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { Flight } from '../../core/models';
import { airportDay, DayStep } from '../../core/services/alerts-engine';
import { AirportDbService, haversineKm } from '../../core/services/airport-db.service';
import { LocationService } from '../../core/services/location.service';

/** "Your airport day": the flight day as a live timeline, from leaving home to landing. */
@Component({
  selector: 'gm-airport-day',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon],
  template: `
    <div class="head">
      <div>
        <span class="gm-label">Your airport day</span>
        <b>{{ dayLabel() }}</b>
      </div>
      @if (!usingLocation()) {
        <button class="loc" (click)="useLocation()"><ion-icon name="navigate-outline" /> Use my location</button>
      }
    </div>
    <ol>
      @for (s of steps(); track s.id; let i = $index) {
        <li [class.done]="i < current()" [class.now]="i === current()" [style.--i]="i">
          <span class="dot"><ion-icon [name]="i < current() ? 'checkmark' : s.icon" /></span>
          <div class="txt">
            <b>{{ s.title }}</b>
            <small>{{ s.detail }}</small>
          </div>
          <time>{{ time(s) }}</time>
        </li>
      }
    </ol>
    <p class="note">Typical airline cut-offs. Your airline’s times on the boarding pass always win.</p>
  `,
  styles: `
    :host { display: block; padding: 16px; }
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
    .head b { display: block; font-size: 17px; color: var(--gm-ink); margin-top: 2px; }
    .loc { display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; color: var(--gm-accent-deep); background: var(--gm-accent-soft); flex: none; }
    ol { list-style: none; margin: 0; padding: 0; position: relative; }
    li { position: relative; display: grid; grid-template-columns: 34px 1fr auto; gap: 12px; align-items: center; padding: 8px 0; animation: day-in .5s var(--gm-ease-out) both; animation-delay: calc(var(--i) * 45ms); }
    li:not(:last-child)::after { content: ''; position: absolute; left: 16px; top: 40px; bottom: -8px; width: 2px; background: var(--gm-line); }
    li.done:not(:last-child)::after { background: var(--gm-accent); }
    .dot { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font-size: 16px; color: var(--gm-ink-3); background: #f1f4f7; position: relative; z-index: 1; transition: background .3s, color .3s; }
    li.done .dot { color: #fff; background: var(--gm-accent); }
    li.now .dot { color: #fff; background: var(--gm-ink); box-shadow: 0 0 0 5px rgba(15, 181, 195, .22); animation: day-pulse 2s ease-in-out infinite; }
    .txt { display: flex; flex-direction: column; min-width: 0; }
    .txt b { font-size: 14.5px; color: var(--gm-ink); }
    .txt small { font-size: 12.5px; color: var(--gm-ink-3); }
    li.done .txt b { color: var(--gm-ink-3); }
    time { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 15px; color: var(--gm-ink); }
    li.done time { color: var(--gm-ink-3); font-weight: 600; }
    .note { margin: 10px 0 0; font-size: 11.5px; color: var(--gm-ink-3); }
    @keyframes day-in { from { opacity: 0; transform: translateY(6px); } }
    @keyframes day-pulse { 50% { box-shadow: 0 0 0 9px rgba(15, 181, 195, .08); } }
    :host-context(.gm-reduce-motion) li, :host-context(.gm-reduce-motion) li.now .dot { animation: none; }
  `,
})
export class AirportDayComponent {
  readonly flight = input.required<Flight>();
  private db = inject(AirportDbService);
  private location = inject(LocationService);
  private now = signal(Date.now());
  readonly usingLocation = computed(() => !!this.location.fix());

  readonly steps = computed<DayStep[]>(() => {
    this.db.ready();
    const f = this.flight();
    return airportDay(f, {
      countryOf: (c) => this.db.get(c)?.country,
      kmToAirport: (c) => {
        const fix = this.location.fix(), a = this.db.get(c);
        return fix && a ? haversineKm(fix.lat, fix.lon, a.lat, a.lon) : undefined;
      },
    });
  });
  /** Index of the next thing to do. */
  readonly current = computed(() => {
    const n = this.now();
    const i = this.steps().findIndex((s) => s.at > n);
    return i === -1 ? this.steps().length : i;
  });
  readonly dayLabel = computed(() => {
    const f = this.flight();
    try {
      return new Date(f.departure).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: f.from.timezone });
    } catch {
      return new Date(f.departure).toDateString();
    }
  });

  constructor() {
    void this.db.load().catch(() => {});
    const t = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  time(s: DayStep): string {
    const f = this.flight();
    const tz = s.id === 'landing' ? f.to.timezone : f.from.timezone;
    try {
      return new Date(s.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz });
    } catch {
      return new Date(s.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
  }

  useLocation() {
    void this.location.locate();
  }
}
