import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { DestinationService } from '../../core/services/destination.service';
import { AirportDbService } from '../../core/services/airport-db.service';

@Component({
  selector: 'gm-city-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fallback" [style.--h]="hue()" [attr.aria-label]="alt() || code()" role="img">
      <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        @for (d of contours(); track $index) {
          <path [attr.d]="d" />
        }
      </svg>
      <span class="code">{{ code() }}</span>
      @if (coords(); as c) {
        <span class="coords">{{ c }}</span>
      }
    </div>
    @if (url() && !failed()) {
      <img [src]="url()" [alt]="alt()" loading="lazy" decoding="async" referrerpolicy="no-referrer" [class.ready]="loaded()" (load)="loaded.set(true)" (error)="failed.set(true)" />
      @if (showCredit() && loaded() && credit()) {
        <span class="credit">{{ credit() }}</span>
      }
    }
  `,
  styles: `
    :host { position: relative; display: block; overflow: hidden; background: #24343f; }
    .fallback, img { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .fallback {
      background:
        radial-gradient(120% 90% at 85% 10%, hsl(var(--h) 38% 58% / .55), transparent 60%),
        linear-gradient(160deg, hsl(var(--h) 30% 40%), hsl(calc(var(--h) + 20) 34% 24%));
    }
    svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    svg path { fill: none; stroke: rgba(255,255,255,.13); stroke-width: 1; }
    .code { position: absolute; right: 14px; bottom: 2px; font-size: 76px; font-weight: 800; letter-spacing: -.04em; line-height: 1;
      color: rgba(255,255,255,.14); font-feature-settings: 'tnum'; }
    .coords { position: absolute; right: 14px; top: 12px; font-size: 10.5px; letter-spacing: .08em; color: rgba(255,255,255,.55); font-variant-numeric: tabular-nums; }
    img { object-fit: cover; opacity: 0; transform: scale(1.03); transition: opacity .5s ease, transform 1s cubic-bezier(.22,1,.36,1); }
    img.ready { opacity: 1; transform: none; }
    .credit { position: absolute; right: 8px; bottom: 6px; font-size: 9.5px; color: rgba(255,255,255,.85); text-shadow: 0 1px 3px rgba(0,0,0,.5); pointer-events: none; }
  `,
})
export class CityImageComponent {
  readonly code = input.required<string>();
  readonly src = input<string | undefined>();
  readonly alt = input('');
  readonly showCredit = input(false);

  private dest = inject(DestinationService);
  private db = inject(AirportDbService);
  private fetched = signal<{ url: string; credit: string } | undefined>(undefined);
  readonly url = computed(() => this.src() ?? this.fetched()?.url);
  readonly credit = computed(() => (this.src() ? '' : this.fetched()?.credit ?? ''));
  readonly loaded = signal(false);
  readonly failed = signal(false);
  private record = signal<{ lat: number; lon: number } | undefined>(undefined);

  readonly hue = computed(() => {
    let h = 0;
    for (const ch of this.code()) h = (h * 31 + ch.charCodeAt(0)) % 360;
    const bands = [190, 200, 175, 160, 210, 28, 35, 145, 220, 185];
    return bands[h % bands.length];
  });

  readonly coords = computed(() => {
    const r = this.record();
    if (!r) return '';
    const f = (v: number, p: string, n: string) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? p : n}`;
    return `${f(r.lat, 'N', 'S')}  ${f(r.lon, 'E', 'W')}`;
  });

  readonly contours = computed(() => {
    let seed = 0;
    for (const ch of this.code()) seed = seed * 7 + ch.charCodeAt(0);
    const out: string[] = [];
    for (let k = 0; k < 9; k++) {
      const y0 = 30 + k * 22;
      const a = 6 + ((seed >> k) % 10);
      const f = 0.012 + ((seed * (k + 3)) % 7) / 900;
      const ph = (seed % 50) / 10 + k * 0.6;
      let d = `M0 ${y0.toFixed(1)}`;
      for (let x = 10; x <= 400; x += 10) d += ` L${x} ${(y0 + Math.sin(x * f + ph) * a + Math.sin(x * f * 2.3 + k) * a * 0.35).toFixed(1)}`;
      out.push(d);
    }
    return out;
  });

  constructor() {
    effect(() => {
      const code = this.code();
      this.loaded.set(false);
      this.failed.set(false);
      void this.db.load().then(() => this.record.set(this.db.get(code))).catch(() => {});
      if (this.src()) return;
      void this.dest.photo(code).then((p) => this.fetched.set(p ? { url: p.url, credit: p.credit } : undefined)).catch(() => {});
    });
  }
}
