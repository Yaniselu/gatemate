import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { DestinationService } from '../../core/services/destination.service';

interface Palette {
  sky: [string, string];
  sun: string;
  far: string;
  mid: string;
  near: string;
  water?: string;
}

const PALETTES: Record<string, Palette> = {
  BCN: { sky: ['#5ec8ff', '#ffd3a8'], sun: '#fff1c9', far: '#b9cfe0', mid: '#7f9bb4', near: '#3b5670', water: '#4cb7d6' },
  LIS: { sky: ['#ffb36b', '#ffe2b8'], sun: '#fff6dc', far: '#e9c3a8', mid: '#c98f6f', near: '#7a4a3c', water: '#5aa9c9' },
  CDG: { sky: ['#8fb7ff', '#f7d7e8'], sun: '#fff', far: '#c8d2ea', mid: '#8d9ac0', near: '#4a5478', water: '#7aa3d6' },
  ATH: { sky: ['#3fb8e8', '#cdf1ff'], sun: '#fff8d6', far: '#d8e6d2', mid: '#b9a98e', near: '#6f6250' },
  FCO: { sky: ['#ff9f7a', '#ffe0b0'], sun: '#fff1d0', far: '#efc6a6', mid: '#c98a62', near: '#7c4a32' },
  JFK: { sky: ['#1d2b64', '#f8a07a'], sun: '#ffd8a8', far: '#5f6d9a', mid: '#3d4a78', near: '#1b2448', water: '#2d4a7a' },
  DXB: { sky: ['#f6a35b', '#fde3b0'], sun: '#fff4d6', far: '#f0c99a', mid: '#d29a62', near: '#8a5a32' },
  OTP: { sky: ['#6fc3e8', '#e3f5ff'], sun: '#fffbe6', far: '#c7dbe6', mid: '#93aebd', near: '#4f6878' },
  CLJ: { sky: ['#7ad0c9', '#e8fbf4'], sun: '#fffbe6', far: '#b8dcc9', mid: '#79ad94', near: '#3f6b58' },
};

/**
 * Destination cover. Shows the real photo when the backend provides one (`src`), with a blur-up
 * fade-in, and falls back to a lightweight vector illustration of the city's landmark.
 */
@Component({
  selector: 'gm-city-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" role="img" [attr.aria-label]="alt() || code()">
      <defs>
        <linearGradient [attr.id]="'sky-' + uid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" [attr.stop-color]="p().sky[0]" />
          <stop offset="1" [attr.stop-color]="p().sky[1]" />
        </linearGradient>
        <radialGradient [attr.id]="'sun-' + uid">
          <stop offset="0" [attr.stop-color]="p().sun" />
          <stop offset="1" [attr.stop-color]="p().sun" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="220" [attr.fill]="'url(#sky-' + uid + ')'" />
      <circle class="sun" cx="300" cy="70" r="70" [attr.fill]="'url(#sun-' + uid + ')'" />
      <circle cx="300" cy="70" r="20" [attr.fill]="p().sun" opacity=".9" />
      <g class="clouds" fill="#fff" opacity=".55">
        <ellipse cx="80" cy="50" rx="34" ry="9" /><ellipse cx="100" cy="44" rx="20" ry="10" />
        <ellipse cx="220" cy="34" rx="26" ry="7" />
      </g>

      @switch (scene()) {
        @case ('BCN') {
          <path [attr.fill]="p().far" d="M0 150 Q60 120 120 140 T240 135 T400 140 V220 H0Z" />
          <g [attr.fill]="p().mid">
            <rect x="150" y="95" width="100" height="60" />
            @for (s of bcnSpires; track $index) {
              <path [attr.d]="'M' + s.x + ' 155 V' + s.y + ' L' + (s.x + s.w / 2) + ' ' + (s.y - 26) + ' L' + (s.x + s.w) + ' ' + s.y + ' V155Z'" />
            }
          </g>
          <rect y="168" width="400" height="52" [attr.fill]="p().water" />
          <path d="M0 176 Q50 172 100 176 T200 176 T300 176 T400 176" stroke="#fff" stroke-opacity=".5" fill="none" />
          <g [attr.fill]="p().near">
            <rect x="40" y="120" width="4" height="50" /><path d="M42 120 q-20 -6 -26 6 M42 120 q20 -6 26 6 M42 118 q-10 -14 -22 -10 M42 118 q10 -14 22 -10" [attr.stroke]="p().near" stroke-width="5" fill="none" stroke-linecap="round" />
            <rect x="350" y="128" width="4" height="42" /><path d="M352 128 q-18 -6 -24 6 M352 128 q18 -6 24 6 M352 126 q-9 -12 -20 -9" [attr.stroke]="p().near" stroke-width="5" fill="none" stroke-linecap="round" />
          </g>
        }
        @case ('LIS') {
          <path [attr.fill]="p().far" d="M0 120 Q80 90 170 115 T400 105 V220 H0Z" />
          <g>
            @for (h of lisHouses; track $index) {
              <rect [attr.x]="h.x" [attr.y]="h.y" width="22" [attr.height]="140 - h.y + 40" [attr.fill]="h.c" />
              <path [attr.d]="'M' + (h.x - 2) + ' ' + h.y + ' l13 -9 l13 9z'" fill="#c0533b" />
            }
          </g>
          <rect y="175" width="400" height="45" [attr.fill]="p().water" />
          <g stroke="#d4442e" stroke-width="3" fill="none">
            <path d="M210 176 V120 M330 176 V120" /><path d="M150 150 Q210 118 210 118 Q270 165 330 118 Q370 140 400 150" stroke-width="1.6" />
          </g>
          <rect x="150" y="150" width="250" height="5" fill="#d4442e" />
          <g class="tram">
            <rect x="40" y="150" width="62" height="26" rx="5" fill="#f6c431" />
            <rect x="46" y="155" width="12" height="9" rx="2" fill="#fff" opacity=".8" /><rect x="62" y="155" width="12" height="9" rx="2" fill="#fff" opacity=".8" /><rect x="78" y="155" width="12" height="9" rx="2" fill="#fff" opacity=".8" />
            <rect x="40" y="168" width="62" height="3" fill="#c0533b" />
            <circle cx="54" cy="178" r="4" fill="#333" /><circle cx="88" cy="178" r="4" fill="#333" />
          </g>
        }
        @case ('CDG') {
          <g [attr.fill]="p().far">
            @for (b of skyline(9, 120, 30); track $index) { <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="220 - b.y" /> }
          </g>
          <g [attr.fill]="p().near">
            <path d="M200 24 L203 24 L206 70 L214 110 L226 150 L240 186 L226 186 Q201 150 176 186 L162 186 L176 150 L188 110 L196 70Z" />
            <rect x="182" y="108" width="36" height="5" /><rect x="172" y="146" width="56" height="6" />
          </g>
          <rect y="186" width="400" height="34" [attr.fill]="p().water" />
          <path d="M0 196 H400" stroke="#fff" stroke-opacity=".4" stroke-dasharray="14 10" />
        }
        @case ('ATH') {
          <path [attr.fill]="p().far" d="M0 160 Q100 130 200 150 T400 140 V220 H0Z" />
          <path [attr.fill]="p().mid" d="M70 220 L110 150 Q200 128 300 148 L340 220Z" />
          <g [attr.fill]="'#f4ecd8'">
            <path d="M140 110 L200 92 L260 110Z" /><rect x="140" y="110" width="120" height="6" />
            @for (c of [0, 1, 2, 3, 4, 5, 6, 7]; track c) { <rect [attr.x]="146 + c * 14.5" y="116" width="7" height="30" /> }
            <rect x="136" y="146" width="128" height="6" />
          </g>
          <g [attr.fill]="p().near"><circle cx="60" cy="190" r="16" /><rect x="58" y="190" width="4" height="30" /><circle cx="355" cy="195" r="13" /></g>
        }
        @case ('FCO') {
          <path [attr.fill]="p().far" d="M0 165 Q120 140 240 160 T400 150 V220 H0Z" />
          <g [attr.fill]="p().mid">
            <path d="M90 190 V95 Q200 70 310 95 V190Z" />
          </g>
          <g [attr.fill]="p().sky[1]" opacity=".9">
            @for (row of [0, 1, 2]; track row) {
              @for (c of [0, 1, 2, 3, 4, 5, 6, 7, 8]; track c) {
                <path [attr.d]="'M' + (100 + c * 23) + ' ' + (180 - row * 28) + ' v-14 a7 7 0 0 1 14 0 v14z'" />
              }
            }
          </g>
          <rect y="190" width="400" height="30" [attr.fill]="p().near" />
          <g [attr.fill]="p().near"><path d="M30 190 L42 120 L54 190Z" /><path d="M360 190 L370 130 L380 190Z" /></g>
        }
        @case ('JFK') {
          <g [attr.fill]="p().far">
            @for (b of skyline(14, 90, 26); track $index) { <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="220 - b.y" /> }
          </g>
          <g [attr.fill]="p().near">
            <path d="M190 40 L193 20 L196 40 L200 60 V180 H186 V60Z" />
            @for (b of skyline(10, 120, 34, 7); track $index) { <rect [attr.x]="b.x" [attr.y]="b.y + 20" [attr.width]="b.w" [attr.height]="200 - b.y" /> }
          </g>
          <g fill="#ffd27a" opacity=".85">
            @for (w of windows; track $index) { <rect [attr.x]="w.x" [attr.y]="w.y" width="2.5" height="3.5" /> }
          </g>
          <rect y="188" width="400" height="32" [attr.fill]="p().water" />
        }
        @case ('DXB') {
          <path [attr.fill]="p().far" d="M0 175 Q90 150 180 172 T400 165 V220 H0Z" />
          <g [attr.fill]="p().mid">
            @for (b of skyline(8, 130, 28, 3); track $index) { <rect [attr.x]="b.x" [attr.y]="b.y + 15" [attr.width]="b.w" [attr.height]="220 - b.y" /> }
          </g>
          <path [attr.fill]="p().near" d="M200 8 L202 8 L204 60 L210 62 L212 110 L220 112 L224 160 L234 162 L238 200 L164 200 L168 162 L178 160 L182 112 L190 110 L192 62 L198 60Z" />
          <path [attr.fill]="p().near" d="M0 200 Q100 185 200 200 T400 196 V220 H0Z" />
        }
        @case ('OTP') {
          <path [attr.fill]="p().far" d="M0 160 Q120 140 240 155 T400 150 V220 H0Z" />
          <g [attr.fill]="p().mid">
            <rect x="80" y="130" width="240" height="60" /><rect x="110" y="110" width="180" height="22" /><rect x="140" y="92" width="120" height="20" />
            <rect x="175" y="68" width="50" height="26" /><path d="M175 68 L200 52 L225 68Z" />
          </g>
          <g fill="#fff" opacity=".35">
            @for (c of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; track c) { <rect [attr.x]="88 + c * 19.5" y="140" width="8" height="12" /><rect [attr.x]="88 + c * 19.5" y="162" width="8" height="12" /> }
          </g>
          <rect y="190" width="400" height="30" [attr.fill]="p().near" />
          <g [attr.fill]="p().near"><circle cx="40" cy="178" r="18" /><circle cx="365" cy="180" r="15" /></g>
        }
        @case ('CLJ') {
          <path [attr.fill]="p().far" d="M0 140 Q100 100 200 130 T400 115 V220 H0Z" />
          <path [attr.fill]="p().mid" d="M0 175 Q120 150 240 170 T400 160 V220 H0Z" />
          <g [attr.fill]="p().near">
            <rect x="170" y="120" width="70" height="70" /><path d="M170 120 L205 98 L240 120Z" />
            <rect x="226" y="60" width="18" height="70" /><path d="M224 60 L235 18 L246 60Z" />
          </g>
          <rect y="190" width="400" height="30" [attr.fill]="p().near" />
        }
        @default {
          <path [attr.fill]="p().far" d="M0 150 L80 90 L150 140 L230 70 L320 135 L400 100 V220 H0Z" />
          <path [attr.fill]="p().mid" d="M0 180 Q120 150 240 175 T400 165 V220 H0Z" />
          <path [attr.fill]="p().near" d="M0 200 Q150 185 300 200 T400 196 V220 H0Z" />
        }
      }
      <g class="birds" fill="none" [attr.stroke]="p().near" stroke-width="1.6" stroke-linecap="round" opacity=".6">
        <path d="M60 80 q5 -5 10 0 q5 -5 10 0" /><path d="M86 70 q4 -4 8 0 q4 -4 8 0" />
      </g>
    </svg>
    @if (url() && !failed()) {
      <img [src]="url()" [alt]="alt()" loading="lazy" decoding="async" referrerpolicy="no-referrer" [class.ready]="loaded()" (load)="loaded.set(true)" (error)="failed.set(true)" />
      @if (showCredit() && loaded() && credit()) {
        <span class="credit">{{ credit() }}</span>
      }
    }
  `,
  styles: `
    :host { position: relative; display: block; overflow: hidden; }
    svg, img { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    img { object-fit: cover; opacity: 0; transform: scale(1.04); transition: opacity .6s ease, transform 1.2s cubic-bezier(.22,1,.36,1); }
    img.ready { opacity: 1; transform: none; }
    .credit { position: absolute; right: 8px; bottom: 6px; font-size: 9.5px; color: rgba(255,255,255,.85); text-shadow: 0 1px 3px rgba(0,0,0,.5); pointer-events: none; }
    .clouds { animation: drift 30s linear infinite alternate; }
    .birds { animation: birds 12s ease-in-out infinite alternate; }
    .sun { animation: glow 6s ease-in-out infinite; transform-origin: 300px 70px; }
    .tram { animation: tram 9s ease-in-out infinite alternate; }
    @keyframes drift { to { transform: translateX(40px); } }
    @keyframes birds { to { transform: translate(60px, -10px); } }
    @keyframes glow { 50% { transform: scale(1.12); opacity: .8; } }
    @keyframes tram { to { transform: translateX(30px); } }
  `,
})
export class CityImageComponent {
  /** IATA airport code of the destination. */
  readonly code = input.required<string>();
  /** Optional licensed photo URL from the backend. */
  readonly src = input<string | undefined>();
  readonly alt = input('');
  readonly showCredit = input(false);

  private dest = inject(DestinationService);
  private fetched = signal<{ url: string; credit: string } | undefined>(undefined);
  /** Backend/licensed photo first, otherwise the destination's lead photo; the illustration stays underneath as fallback. */
  readonly url = computed(() => this.src() ?? this.fetched()?.url);
  readonly credit = computed(() => (this.src() ? '' : this.fetched()?.credit ?? ''));

  constructor() {
    effect(() => {
      const code = this.code();
      if (this.src()) return;
      this.loaded.set(false);
      this.failed.set(false);
      void this.dest.photo(code).then((p) => this.fetched.set(p ? { url: p.url, credit: p.credit } : undefined)).catch(() => {});
    });
  }

  readonly loaded = signal(false);
  readonly failed = signal(false);
  readonly uid = Math.random().toString(36).slice(2, 8);

  readonly scene = computed(() => (PALETTES[this.code()] ? this.code() : 'default'));
  readonly p = computed(() => PALETTES[this.code()] ?? PALETTES['OTP']);

  readonly bcnSpires = [
    { x: 160, y: 70, w: 14 }, { x: 180, y: 50, w: 16 }, { x: 200, y: 36, w: 18 }, { x: 222, y: 52, w: 16 }, { x: 240, y: 74, w: 13 },
  ];
  readonly lisHouses = Array.from({ length: 14 }, (_, i) => ({
    x: 8 + i * 28,
    y: 110 + Math.round(Math.sin(i * 0.9) * 14) + (i > 8 ? 12 : 0),
    c: ['#f6d2a4', '#f0a59a', '#9fd3d6', '#f6e7b4', '#e8b9d4', '#ffffff'][i % 6],
  }));
  readonly windows = Array.from({ length: 70 }, (_, i) => ({ x: 20 + ((i * 37) % 360), y: 110 + ((i * 53) % 70) }));

  /** Deterministic skyline blocks. */
  skyline(count: number, top: number, width: number, seed = 1) {
    return Array.from({ length: count }, (_, i) => {
      const h = ((i * 47 + seed * 13) % 60) + 10;
      return { x: (i * 400) / count + ((i * seed) % 6), y: top - h + 40, w: width - ((i + seed) % 3) * 5 };
    });
  }
}
