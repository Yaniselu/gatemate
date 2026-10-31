import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { Flight } from '../../core/models';
import { LiveFlightService, LiveState } from '../../core/services/live-flight.service';
import { AirportDbService } from '../../core/services/airport-db.service';
import { RouteLine } from '../../core/utils/travel-summary';
import { RouteMapComponent } from './route-map.component';
import { locale, t, TranslatePipe } from '../../core/i18n/i18n.service';

const LABEL: Record<LiveState['phase'], string> = {
  scheduled: 'Not departed yet',
  taxiing: 'On the ground · taxiing',
  airborne: 'In the air',
  landed: 'Landed',
  'no-signal': 'No live signal right now',
};

@Component({
  selector: 'gm-live-flight',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonIcon, DecimalPipe, RouteMapComponent],
  template: `
    <div class="top">
      <span class="badge" [attr.data-phase]="state()?.phase ?? 'loading'"><i></i>{{ (state() ? label[state()!.phase] : 'Looking for the plane…') | t }}</span>
      <span class="live">{{ 'LIVE' | t }}</span>
    </div>
    <div class="bar">
      <b>{{ flight().from.code }}</b>
      <div class="track"><span class="fill" [style.width.%]="pct()"></span><ion-icon name="airplane" [style.left.%]="pct()" /></div>
      <b>{{ flight().to.code }}</b>
    </div>
    @if (state(); as s) {
      @if (s.phase === 'airborne' || s.phase === 'taxiing') {
        <div class="stats">
          <div><small>{{ 'Altitude' | t }}</small><b>{{ s.altitudeFt ? (s.altitudeFt | number) + ' ft' : ('Ground' | t) }}</b></div>
          <div><small>{{ 'Speed' | t }}</small><b>{{ s.speedKmh }} km/h</b></div>
          <div><small>{{ 'Lands ≈' | t }}</small><b>{{ s.eta ? clock(s.eta) : '—' }}</b></div>
        </div>
        <gm-route-map class="map" [routes]="route()" [plane]="s.lat !== undefined ? { lat: s.lat, lon: s.lon!, heading: s.heading } : null" />
      } @else if (s.phase === 'no-signal') {
        <p class="note">{{ 'Planes are tracked by volunteer receivers on the ground. Over sea or remote areas the signal can drop for a while. We keep checking.' | t }}</p>
      } @else if (s.phase === 'scheduled') {
        <p class="note">{{ 'Live tracking starts an hour before departure.' | t }}</p>
      }
      <small class="foot">
        @if (s.aircraft || s.registration) { {{ s.aircraft }} {{ s.registration }} · }
        {{ s.callsign ? s.callsign + ' · ' : '' }}{{ 'ADS-B, updated {ago}' | t: { ago: ago() | t } }}
      </small>
    }
  `,
  styles: `
    :host { display: block; padding: 14px 16px; background: linear-gradient(140deg, #0b1b2b, #0b3a4a 60%, #0a6e80); color: #fff; border-radius: 20px; overflow: hidden; }
    .top { display: flex; justify-content: space-between; align-items: center; }
    .badge { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; }
    .badge i { width: 9px; height: 9px; border-radius: 50%; background: #5ee7f0; box-shadow: 0 0 0 0 rgba(94,231,240,.7); animation: live-pulse 1.6s infinite; }
    .badge[data-phase='landed'] i { background: #34d399; animation: none; }
    .badge[data-phase='no-signal'] i, .badge[data-phase='scheduled'] i { background: #fbbf24; animation: none; }
    .live { font-size: 10px; font-weight: 800; letter-spacing: .14em; padding: 3px 7px; border-radius: 6px; background: rgba(255,255,255,.14); }
    .bar { display: flex; align-items: center; gap: 10px; margin: 14px 0 6px; }
    .bar b { font-size: 16px; letter-spacing: .02em; }
    .track { position: relative; flex: 1; height: 4px; border-radius: 4px; background: rgba(255,255,255,.18); }
    .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: linear-gradient(90deg, #5ee7f0, #22c7d3); transition: width 1s var(--gm-ease-out); }
    .track ion-icon { position: absolute; top: 50%; transform: translate(-50%, -50%) rotate(0deg); font-size: 20px; color: #fff; filter: drop-shadow(0 2px 4px rgba(0,0,0,.4)); transition: left 1s var(--gm-ease-out); }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
    .stats div { display: flex; flex-direction: column; padding: 8px 10px; border-radius: 12px; background: rgba(255,255,255,.08); }
    .stats small { font-size: 11px; opacity: .7; }
    .stats b { font-size: 15px; font-variant-numeric: tabular-nums; }
    .map { height: 170px; border-radius: 14px; margin-bottom: 8px; }
    .note { margin: 8px 0; font-size: 13px; line-height: 1.45; opacity: .85; }
    .foot { display: block; font-size: 11px; opacity: .6; }
    @keyframes live-pulse { 70% { box-shadow: 0 0 0 8px rgba(94,231,240,0); } 100% { box-shadow: 0 0 0 0 rgba(94,231,240,0); } }
  `,
})
export class LiveFlightComponent {
  readonly flight = input.required<Flight>();
  private live = inject(LiveFlightService);
  private db = inject(AirportDbService);
  readonly label = LABEL;
  readonly state = signal<LiveState | null>(null);
  private now = signal(Date.now());

  readonly pct = computed(() => {
    const s = this.state();
    if (s?.progress !== undefined) return Math.round(s.progress * 100);
    if (s?.phase === 'landed') return 100;
    return 0;
  });
  readonly route = computed<RouteLine[]>(() => {
    this.db.ready();
    const f = this.flight();
    const a = this.db.get(f.from.code), b = this.db.get(f.to.code);
    return a && b ? [{ from: { code: a.iata, city: a.city, lat: a.lat, lon: a.lon }, to: { code: b.iata, city: b.city, lat: b.lat, lon: b.lon }, count: 1, upcoming: true }] : [];
  });
  readonly ago = computed(() => {
    const s = this.state();
    if (!s) return '';
    const sec = Math.max(0, Math.round((this.now() - s.updatedAt) / 1000));
    return sec < 10 ? t('just now') : sec < 60 ? t('{n} s ago', { n: sec }) : t('{n} min ago', { n: Math.round(sec / 60) });
  });

  constructor() {
    void this.db.load().catch(() => {});
    const poll = async () => this.state.set(await this.live.get(this.flight()));
    setTimeout(() => void poll(), 0);
    const t = setInterval(() => void poll(), 30_000);
    const c = setInterval(() => this.now.set(Date.now()), 5000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(t);
      clearInterval(c);
    });
  }

  clock(t: number) {
    try {
      return new Date(t).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', timeZone: this.flight().to.timezone });
    } catch {
      return new Date(t).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
    }
  }
}
