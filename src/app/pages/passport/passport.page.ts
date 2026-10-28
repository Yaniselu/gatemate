import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { AirportDbService } from '../../core/services/airport-db.service';
import { TravelStore } from '../../core/services/travel.store';
import { ToastService } from '../../core/services/toast.service';
import { PlatformService } from '../../core/services/platform.service';
import { flagEmoji, summarize, TravelSummary } from '../../core/utils/travel-summary';
import { CARD_FONT, isShareCancel, loadImage, roundRect, shareCanvas } from '../../core/utils/share-image';
import { RouteMapComponent } from '../../shared/components/route-map.component';
import { CountUpDirective } from '../../shared/directives/count-up.directive';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { PressableDirective } from '../../shared/directives/pressable.directive';

type Period = 'all' | number;

@Component({
  selector: 'gm-passport',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonIcon, RouterLink, DecimalPipe, RouteMapComponent, CountUpDirective, RevealDirective, PressableDirective],
  templateUrl: './passport.page.html',
  styleUrl: './passport.page.scss',
})
export class PassportPage {
  private store = inject(TravelStore);
  private db = inject(AirportDbService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private platform = inject(PlatformService);

  readonly period = signal<Period>('all');
  readonly sharing = signal(false);
  readonly loading = computed(() => this.store.tripsState() !== 'ready' || !this.db.ready());

  private flights = computed(() => this.store.trips().flatMap((t) => t.flights));
  readonly years = computed(() => {
    const now = Date.now();
    const ys = new Set(this.flights().filter((f) => new Date(f.arrival).getTime() < now).map((f) => new Date(f.departure).getFullYear()));
    return [...ys].sort((a, b) => b - a);
  });
  readonly summary = computed<TravelSummary>(() => {
    this.db.ready();
    const p = this.period();
    const list = p === 'all' ? this.flights() : this.flights().filter((f) => new Date(f.departure).getFullYear() === p);
    return summarize(list, (c) => this.db.get(c));
  });
  readonly countries = computed(() =>
    this.summary().countries.map((cc) => ({ cc, flag: flagEmoji(cc), name: this.db.countryName(cc) || cc })),
  );
  readonly upcomingCount = computed(() => this.summary().routes.filter((r) => r.upcoming).length);
  /** A light-hearted comparison so big numbers mean something. */
  readonly fact = computed(() => {
    const s = this.summary();
    if (!s.flights) return '';
    if (s.laps >= 1) return `That’s ${s.laps.toFixed(1)}× around the Earth.`;
    if (s.km >= 400) return `That’s ${Math.max(1, Math.round(s.laps * 100))}% of the way around the Earth.`;
    return '';
  });

  constructor() {
    void this.store.loadTrips();
    void this.db.load().catch(() => {});
  }

  setPeriod(p: Period) {
    this.platform.selection();
    this.period.set(p);
  }

  async share(): Promise<void> {
    if (this.sharing()) return;
    this.sharing.set(true);
    try {
      const canvas = await this.renderCard();
      const label = this.period() === 'all' ? 'my travels so far' : `my ${this.period()} in travel`;
      await shareCanvas(canvas, `gatemate-passport-${this.period()}.png`, `${cap(label)} ✈️ — made with Gatemate`);
      this.platform.success();
    } catch (e) {
      if (!isShareCancel(e)) void this.toast.show('Couldn’t create the image. Please try again.', 'error');
    } finally {
      this.sharing.set(false);
    }
  }

  /** 1080×1350 (Instagram portrait) card, drawn locally: no network, nothing uploaded. */
  private async renderCard(): Promise<HTMLCanvasElement> {
    const s = this.summary();
    const W = 1080, H = 1350;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d')!;
    const font = (w: number, px: number) => `${w} ${px}px ${CARD_FONT}`;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, W, 560);
    g.addColorStop(0, '#0fb5c3');
    g.addColorStop(1, '#08707f');
    ctx.fillStyle = g;
    roundRect(ctx, 0, -40, W, 600, 56);
    ctx.fill();

    const logo = await loadImage('logo.png');
    if (logo) {
      ctx.fillStyle = '#fff';
      roundRect(ctx, 72, 72, 76, 76, 20);
      ctx.fill();
      ctx.save();
      roundRect(ctx, 72, 72, 76, 76, 20);
      ctx.clip();
      ctx.drawImage(logo, 72, 72, 76, 76);
      ctx.restore();
    }
    ctx.fillStyle = '#fff';
    ctx.font = font(700, 34);
    ctx.fillText('Gatemate', 168, 122);
    ctx.font = font(600, 30);
    ctx.globalAlpha = 0.85;
    const period = this.period() === 'all' ? 'ALL TIME' : String(this.period());
    ctx.textAlign = 'right';
    ctx.fillText(period, W - 72, 122);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;

    const first = (this.auth.user()?.name ?? '').split(' ')[0];
    ctx.font = font(800, 76);
    ctx.fillText(first ? `${first}’s travel` : 'My travel', 72, 250);
    ctx.font = font(800, 76);
    ctx.fillText('passport', 72, 334);

    // Route sketch: airports projected into the header, connected by arcs.
    this.drawRoutes(ctx, s, { x: 72, y: 372, w: W - 144, h: 150 });

    // Stats grid.
    const stats: [string, string][] = [
      [s.flights.toLocaleString('en'), s.flights === 1 ? 'flight' : 'flights'],
      [s.km.toLocaleString('en'), 'km flown'],
      [String(s.countries.length), s.countries.length === 1 ? 'country' : 'countries'],
      [String(s.airports), 'airports'],
      [String(s.hours), 'hours in the air'],
      s.laps >= 1 ? [s.laps.toFixed(1) + '×', 'around the Earth'] : [Math.round(s.laps * 100) + '%', 'around the Earth'],
    ];
    const cw = (W - 144 - 40) / 3, ch = 170;
    stats.forEach(([v, l], i) => {
      const x = 72 + (i % 3) * (cw + 20), y = 620 + Math.floor(i / 3) * (ch + 20);
      ctx.fillStyle = '#f2f7f9';
      roundRect(ctx, x, y, cw, ch, 28);
      ctx.fill();
      ctx.fillStyle = '#0b1b2b';
      ctx.font = font(800, fit(ctx, v, cw - 48, 64));
      ctx.fillText(v, x + 24, y + 92);
      ctx.fillStyle = '#5b6b7e';
      ctx.font = font(600, 26);
      ctx.fillText(l, x + 24, y + 138);
    });

    // Flags.
    const flags = s.countries.slice(0, 12).map(flagEmoji);
    if (flags.length) {
      ctx.font = `60px ${CARD_FONT}`;
      // Advance by the measured width: emoji widths differ between fonts.
      let x = 72;
      for (const f of flags) {
        const w = ctx.measureText(f).width;
        if (x + w > W - 72) break;
        ctx.fillText(f, x, 1080);
        x += w + 16;
      }
      if (s.countries.length > 12) {
        ctx.fillStyle = '#5b6b7e';
        ctx.font = font(700, 28);
        ctx.fillText(`+${s.countries.length - 12} more`, 72, 1140);
      }
    }

    if (s.longest) {
      ctx.fillStyle = '#0b1b2b';
      ctx.font = font(700, 30);
      ctx.fillText(`Longest flight  ${s.longest.from} → ${s.longest.to} · ${s.longest.km.toLocaleString('en')} km`, 72, 1200);
    }

    ctx.fillStyle = '#0a93a6';
    ctx.font = font(700, 28);
    ctx.fillText('Track every flight with Gatemate', 72, 1282);
    return c;
  }

  private drawRoutes(ctx: CanvasRenderingContext2D, s: TravelSummary, box: { x: number; y: number; w: number; h: number }) {
    const pts = s.routes.flatMap((r) => [r.from, r.to]);
    if (!pts.length) return;
    const lons = pts.map((p) => p.lon), lats = pts.map((p) => p.lat);
    const [x0, x1] = [Math.min(...lons), Math.max(...lons)], [y0, y1] = [Math.min(...lats), Math.max(...lats)];
    const sx = box.w / Math.max(x1 - x0, 1), sy = box.h / Math.max(y1 - y0, 1);
    const k = Math.min(sx, sy * 1.6);
    const ox = box.x + (box.w - (x1 - x0) * k) / 2, oy = box.y + (box.h - (y1 - y0) * (k / 1.6)) / 2;
    const P = (p: { lat: number; lon: number }) => [ox + (p.lon - x0) * k, oy + (y1 - p.lat) * (k / 1.6)] as const;
    ctx.lineCap = 'round';
    for (const r of s.routes) {
      const [ax, ay] = P(r.from), [bx, by] = P(r.to);
      const lift = Math.min(60, Math.hypot(bx - ax, by - ay) * 0.25);
      ctx.strokeStyle = r.upcoming ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.95)';
      ctx.lineWidth = r.upcoming ? 3 : 4;
      ctx.setLineDash(r.upcoming ? [6, 10] : []);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 - lift, bx, by);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    const seen = new Set<string>();
    for (const p of pts) {
      if (seen.has(p.code)) continue;
      seen.add(p.code);
      const [x, y] = P(p);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      if (seen.size <= 10) {
        ctx.font = `700 22px ${CARD_FONT}`;
        ctx.fillText(p.code, x + 12, y - 10);
      }
    }
  }
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Largest font size (≤ max) at which the text fits the width. */
function fit(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): number {
  let size = max;
  ctx.font = `800 ${size}px ${CARD_FONT}`;
  while (size > 28 && ctx.measureText(text).width > width) {
    size -= 4;
    ctx.font = `800 ${size}px ${CARD_FONT}`;
  }
  return size;
}
