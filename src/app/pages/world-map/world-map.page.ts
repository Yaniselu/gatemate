import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { Preferences } from '@capacitor/preferences';
import { AirportDbService } from '../../core/services/airport-db.service';
import { AuthService } from '../../core/services/auth.service';
import { TravelStore } from '../../core/services/travel.store';
import { flagEmoji, summarize } from '../../core/utils/travel-summary';
import { TranslatePipe } from '../../core/i18n/i18n.service';

interface Country {
  a: string;
  n: string;
  d?: string;
  c: [number, number];
  b?: [number, number, number, number];
  dot?: boolean;
}
interface World {
  w: number;
  h: number;
  sphere: string;
  grat: string;
  countries: Country[];
}
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const WORLD_COUNT = 195;
let worldCache: Promise<World> | null = null;

@Component({
  selector: 'gm-world-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, FormsModule, DecimalPipe, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonIcon],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/passport" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>{{ 'My world map' | t }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <div class="page">
        <section class="stats">
          <div class="big"><b>{{ visited().size }}</b><span>{{ (visited().size === 1 ? 'country visited' : 'countries visited') | t }}</span></div>
          <div class="meter"><i [style.width.%]="pct()"></i></div>
          <div class="row">
            <span><b>{{ pct() | number: '1.0-0' }}%</b> {{ 'of the world' | t }}</span>
            @if (planned().size) { <span class="plan"><i></i>{{ '{n} planned' | t: { n: planned().size } }}</span> }
          </div>
        </section>

        <div class="map card" #box>
          @if (world(); as w) {
            <svg #svg [attr.viewBox]="vb().x + ' ' + vb().y + ' ' + vb().w + ' ' + vb().h" preserveAspectRatio="xMidYMid meet" role="img"
                 [attr.aria-label]="'World map of the countries you have visited' | t"
                 (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up($event)" (pointercancel)="up($event)" (wheel)="wheel($event)">
              <defs>
                <linearGradient id="wm-visited" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1000" y2="520">
                  <stop offset="0" stop-color="#0fb5c3" /><stop offset=".3" stop-color="#2f86e6" /><stop offset=".55" stop-color="#6366f1" />
                  <stop offset=".78" stop-color="#a855f7" /><stop offset="1" stop-color="#ec4899" />
                </linearGradient>
                <pattern id="wm-plan" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="6" height="6" class="plan-bg" /><line x1="0" y1="0" x2="0" y2="6" stroke="#0fb5c3" stroke-width="2.4" />
                </pattern>
              </defs>
              <path [attr.d]="w.sphere" class="ocean" />
              <path [attr.d]="w.grat" class="grat" />
              @for (c of shapes(); track c.a) {
                <path [attr.d]="c.d" [attr.data-a]="c.a" class="land" [class.on]="visited().has(c.a)" [class.plan]="!visited().has(c.a) && planned().has(c.a)"
                      [class.sel]="selected() === c.a" [style.animation-delay.ms]="order().get(c.a) ?? 0" />
              }
              @for (c of dots(); track c.a) {
                <circle [attr.cx]="c.c[0]" [attr.cy]="c.c[1]" [attr.r]="dotR()" [attr.data-a]="c.a" class="dot" [class.on]="visited().has(c.a)"
                        [class.plan]="!visited().has(c.a) && planned().has(c.a)" [class.sel]="selected() === c.a" />
              }
            </svg>
          } @else {
            <div class="loading"><span class="spin"></span></div>
          }
          <div class="zoom">
            <button (click)="zoomBy(0.6)" [attr.aria-label]="'Zoom in' | t"><ion-icon name="add" /></button>
            <button (click)="zoomBy(1.6)" [attr.aria-label]="'Zoom out' | t"><ion-icon name="remove-outline" /></button>
            <button (click)="fit()" [attr.aria-label]="'Show whole world' | t"><ion-icon name="scan-outline" /></button>
          </div>
          <div class="legend">
            <span><i class="v"></i>{{ 'Visited' | t }}</span>
            <span><i class="p"></i>{{ 'Planned' | t }}</span>
          </div>
        </div>

        @if (selectedCountry(); as c) {
          <section class="pick card">
            <span class="flag">{{ flag(c.a) }}</span>
            <div class="txt">
              <b>{{ name(c) }}</b>
              <small>{{ statusLabel(c.a) | t }}</small>
            </div>
            @if (flown().has(c.a)) {
              <span class="badge"><ion-icon name="airplane" />{{ 'From your trips' | t }}</span>
            } @else {
              <button class="toggle" [class.on]="marked().has(c.a)" (click)="toggle(c.a)">
                <ion-icon [name]="marked().has(c.a) ? 'checkmark-circle' : 'add-circle-outline'" />
                {{ (marked().has(c.a) ? 'Visited' : 'Mark as visited') | t }}
              </button>
            }
          </section>
        } @else {
          <p class="hint"><ion-icon name="hand-left-outline" /> {{ 'Tap a country to mark it, pinch to zoom.' | t }}</p>
        }

        <label class="search">
          <ion-icon name="search-outline" />
          <input type="search" [placeholder]="'Add a country you’ve been to…' | t" [ngModel]="query()" (ngModelChange)="query.set($event)" [attr.aria-label]="'Search countries' | t" />
        </label>
        @if (results().length) {
          <div class="results card">
            @for (c of results(); track c.a) {
              <button (click)="choose(c)">
                <span class="flag">{{ flag(c.a) }}</span><span class="nm">{{ name(c) }}</span>
                <ion-icon [name]="visited().has(c.a) ? 'checkmark-circle' : 'add-circle-outline'" [class.on]="visited().has(c.a)" />
              </button>
            }
          </div>
        }

        @if (visitedList().length) {
          <h3 class="sec">{{ 'Your countries' | t }}</h3>
          <div class="chips">
            @for (c of visitedList(); track c.a) {
              <button (click)="focus(c)"><span>{{ flag(c.a) }}</span>{{ name(c) }}</button>
            }
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    :host { --map-ocean: #e8f1fa; --map-land: #d5dde8; --map-line: #ffffff; --map-grat: rgba(15, 60, 110, .07); --plan-bg: #e2f7f9; }
    :host-context(.gm-dark) { --map-ocean: #0b1424; --map-land: #263247; --map-line: #0b1424; --map-grat: rgba(255,255,255,.05); --plan-bg: #10333a; }
    .page { padding: 8px 16px 40px; max-width: 760px; margin: 0 auto; }

    .stats { padding: 6px 4px 14px; }
    .big { display: flex; align-items: baseline; gap: 10px; }
    .big b { font-size: 44px; font-weight: 850; letter-spacing: -.03em; background: linear-gradient(100deg, #0fb5c3, #6366f1 60%, #ec4899); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .big span { font-size: 16px; font-weight: 650; color: var(--gm-ink-2); }
    .meter { height: 8px; margin: 8px 0 8px; border-radius: 99px; background: var(--gm-surface); overflow: hidden; }
    .meter i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #0fb5c3, #6366f1, #ec4899); transition: width .8s var(--gm-ease-out); }
    .row { display: flex; justify-content: space-between; font-size: 13.5px; color: var(--gm-ink-2); }
    .row b { color: var(--gm-ink); }
    .plan { display: inline-flex; align-items: center; gap: 6px; }
    .plan i, .legend .p { width: 14px; height: 10px; border-radius: 3px; background: repeating-linear-gradient(45deg, #0fb5c3 0 2px, var(--plan-bg) 2px 5px); }

    .map { position: relative; overflow: hidden; border-radius: 24px; padding: 0; aspect-ratio: 1000 / 640; touch-action: none; }
    svg { display: block; width: 100%; height: 100%; cursor: grab; user-select: none; -webkit-user-select: none; }
    .ocean { fill: var(--map-ocean); }
    .grat { fill: none; stroke: var(--map-grat); stroke-width: .6; vector-effect: non-scaling-stroke; }
    .land { fill: var(--map-land); stroke: var(--map-line); stroke-width: .6; vector-effect: non-scaling-stroke; transition: fill .35s; }
    .land.on { fill: url(#wm-visited); animation: wm-in .7s var(--gm-ease-out) both; }
    .land.plan { fill: url(#wm-plan); }
    .plan-bg { fill: var(--plan-bg); }
    .land.sel { stroke: #0f172a; stroke-width: 1.8; }
    :host-context(.gm-dark) .land.sel { stroke: #ffffff; }
    .dot { fill: var(--map-land); stroke: var(--map-line); stroke-width: .6; vector-effect: non-scaling-stroke; }
    .dot.on { fill: #a855f7; }
    .dot.plan { fill: #0fb5c3; }
    .dot.sel { stroke: #0f172a; stroke-width: 1.8; }
    @keyframes wm-in { from { fill-opacity: 0; } }

    .zoom { position: absolute; right: 10px; top: 10px; display: flex; flex-direction: column; border-radius: 14px; overflow: hidden;
      background: var(--gm-glass-bg-strong); box-shadow: var(--gm-glass-shadow); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); }
    .zoom button { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 18px; color: var(--gm-ink); background: none; }
    .zoom button + button { border-top: 1px solid var(--gm-line); }
    .legend { position: absolute; left: 10px; bottom: 10px; display: flex; gap: 10px; padding: 6px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700;
      color: var(--gm-ink-2); background: var(--gm-glass-bg-strong); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); }
    .legend span { display: inline-flex; align-items: center; gap: 5px; }
    .legend i { display: inline-block; width: 14px; height: 10px; border-radius: 3px; }
    .legend .v { background: linear-gradient(90deg, #0fb5c3, #6366f1, #ec4899); }
    .loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
    .spin { width: 24px; height: 24px; border-radius: 50%; border: 3px solid var(--gm-line); border-top-color: #0fb5c3; animation: gm-spin .8s linear infinite; }

    .pick { display: flex; align-items: center; gap: 12px; margin-top: 12px; padding: 12px 14px; border-radius: 20px; animation: gm-rise .35s var(--gm-ease-out); }
    .pick .flag { font-size: 30px; }
    .pick .txt { flex: 1; min-width: 0; }
    .pick b { display: block; font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pick small { font-size: 12.5px; color: var(--gm-ink-3); }
    .toggle { display: inline-flex; align-items: center; gap: 6px; padding: 9px 12px; border-radius: 999px; font-weight: 750; font-size: 13.5px; color: #fff; background: var(--gm-solid); white-space: nowrap; }
    .toggle.on { background: linear-gradient(120deg, #0fb5c3, #6366f1); }
    .badge { display: inline-flex; align-items: center; gap: 5px; padding: 7px 10px; border-radius: 999px; font-size: 12px; font-weight: 750; color: var(--gm-accent-strong); background: var(--gm-accent-soft); white-space: nowrap; }
    .hint { display: flex; align-items: center; gap: 6px; margin: 12px 4px 0; font-size: 13px; color: var(--gm-ink-3); }

    .search { display: flex; align-items: center; gap: 8px; height: 46px; padding: 0 14px; margin-top: 14px; border-radius: 16px; background: var(--gm-surface); }
    .search ion-icon { color: var(--gm-ink-3); font-size: 18px; }
    .search input { flex: 1; min-width: 0; border: 0; outline: none; background: none; font-size: 16px; color: var(--gm-ink); }
    .results { margin-top: 6px; padding: 4px; border-radius: 18px; }
    .results button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px; border-radius: 12px; text-align: left; color: var(--gm-ink); background: none; }
    .results button + button { border-top: 1px solid var(--gm-line); }
    .results .flag { font-size: 22px; }
    .results .nm { flex: 1; font-size: 15px; font-weight: 600; }
    .results ion-icon { font-size: 22px; color: var(--gm-ink-3); }
    .results ion-icon.on { color: #6366f1; }

    .sec { margin: 22px 4px 10px; font-size: 17px; font-weight: 800; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chips button { display: inline-flex; align-items: center; gap: 6px; padding: 7px 11px; border-radius: 999px; font-size: 13px; font-weight: 650; color: var(--gm-ink); background: var(--gm-surface); }
    .chips span { font-size: 16px; }
    @media (prefers-reduced-motion: reduce) { .land.on { animation: none; } }
  `,
})
export class WorldMapPage implements OnInit {
  private db = inject(AirportDbService);
  private store = inject(TravelStore);
  private auth = inject(AuthService);
  private svg = viewChild<ElementRef<SVGSVGElement>>('svg');

  readonly world = signal<World | null>(null);
  readonly marked = signal<Set<string>>(new Set());
  readonly selected = signal<string | null>(null);
  readonly query = signal('');
  readonly vb = signal<Box>({ x: 0, y: 0, w: 1000, h: 520 });

  private flights = computed(() => this.store.trips().flatMap((t) => t.flights));
  readonly flown = computed(() => {
    this.db.ready();
    return new Set(summarize(this.flights(), (c) => this.db.get(c)).countries);
  });
  readonly visited = computed(() => new Set([...this.flown(), ...this.marked()]));
  readonly planned = computed(() => {
    this.db.ready();
    const now = Date.now(), out = new Set<string>();
    for (const f of this.flights()) {
      if (new Date(f.arrival).getTime() < now) continue;
      for (const code of [f.from.code, f.to.code]) {
        const cc = this.db.get(code)?.country;
        if (cc && !this.visited().has(cc)) out.add(cc);
      }
    }
    return out;
  });
  readonly pct = computed(() => Math.min(100, (this.visited().size / WORLD_COUNT) * 100));
  readonly shapes = computed(() => this.world()?.countries.filter((c) => !c.dot) ?? []);
  readonly dots = computed(() => this.world()?.countries.filter((c) => c.dot) ?? []);
  readonly order = computed(() => {
    const m = new Map<string, number>();
    [...this.shapes()].filter((c) => this.visited().has(c.a)).sort((a, b) => a.c[0] - b.c[0]).forEach((c, i) => m.set(c.a, i * 70));
    return m;
  });
  readonly dotR = computed(() => Math.max(1.4, Math.min(4, this.vb().w / 220)));
  readonly selectedCountry = computed(() => this.world()?.countries.find((c) => c.a === this.selected()) ?? null);
  readonly visitedList = computed(() =>
    (this.world()?.countries ?? []).filter((c) => this.visited().has(c.a)).sort((a, b) => this.name(a).localeCompare(this.name(b))),
  );
  readonly results = computed(() => {
    const q = fold(this.query().trim());
    if (q.length < 2) return [];
    return (this.world()?.countries ?? []).filter((c) => fold(this.name(c)).includes(q) || fold(c.n).includes(q) || c.a.toLowerCase() === q).slice(0, 8);
  });

  async ngOnInit() {
    void this.db.load().catch(() => {});
    worldCache ??= fetch('data/world.json').then((r) => r.json() as Promise<World>);
    try {
      this.world.set(await worldCache);
    } catch {
      worldCache = null;
    }
    const saved = (await Preferences.get({ key: this.key() })).value;
    if (saved) {
      try {
        this.marked.set(new Set(JSON.parse(saved) as string[]));
      } catch {
      }
    }
    await this.db.load().catch(() => {});
    setTimeout(() => this.frameMine(), 250);
  }

  frameMine() {
    const mine = (this.world()?.countries ?? []).filter((c) => this.visited().has(c.a) || this.planned().has(c.a));
    if (!mine.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of mine) {
      const b = c.b && c.b[2] - c.b[0] < 260 ? c.b : [c.c[0] - 12, c.c[1] - 8, c.c[0] + 12, c.c[1] + 8];
      x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]);
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    let w = Math.max(220, (x1 - x0) * 1.35), h = (y1 - y0) * 1.35;
    if (h > w * 0.52) w = h / 0.52;
    this.animateTo({ x: cx - w / 2, y: cy - (w * 0.52) / 2, w: Math.min(1000, w), h: Math.min(520, w * 0.52) });
  }

  name(c: Country) {
    return this.db.countryName(c.a) || c.n;
  }

  flag(a: string) {
    return flagEmoji(a);
  }

  statusLabel(a: string) {
    if (this.flown().has(a)) return 'Visited on a Gatemate trip';
    if (this.marked().has(a)) return 'Marked by you';
    if (this.planned().has(a)) return 'Planned trip';
    return 'Not visited yet';
  }

  async toggle(a: string) {
    const next = new Set(this.marked());
    if (next.has(a)) next.delete(a);
    else next.add(a);
    this.marked.set(next);
    await Preferences.set({ key: this.key(), value: JSON.stringify([...next]) });
  }

  choose(c: Country) {
    this.query.set('');
    this.focus(c);
    if (!this.visited().has(c.a)) void this.toggle(c.a);
  }

  focus(c: Country) {
    this.selected.set(c.a);
    const [x0, y0, x1, y1] = c.b ?? [c.c[0] - 20, c.c[1] - 12, c.c[0] + 20, c.c[1] + 12];
    const pad = 1.8, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    let w = Math.max(70, (x1 - x0) * pad), h = Math.max(70 * 0.52, (y1 - y0) * pad);
    if (w / h > 1000 / 520) h = w * 0.52;
    else w = h / 0.52;
    this.animateTo({ x: cx - w / 2, y: cy - h / 2, w: Math.min(1000, w), h: Math.min(520, h) });
  }

  fit() {
    this.selected.set(null);
    this.animateTo({ x: 0, y: 0, w: 1000, h: 520 });
  }

  zoomBy(f: number) {
    const v = this.vb();
    this.setView({ x: v.x + (v.w * (1 - f)) / 2, y: v.y + (v.h * (1 - f)) / 2, w: v.w * f, h: v.h * f });
  }

  private pointers = new Map<number, { x: number; y: number }>();
  private moved = 0;
  private pinch = 0;

  down(e: PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.moved = 0;
    this.pinch = this.pointers.size === 2 ? this.spread() : 0;
  }

  move(e: PointerEvent) {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const scale = this.unitsPerPx();
    if (this.pointers.size === 1) {
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      this.moved += Math.abs(dx) + Math.abs(dy);
      const v = this.vb();
      this.setView({ ...v, x: v.x - dx * scale, y: v.y - dy * scale });
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2 && this.pinch) {
      const now = this.spread();
      this.moved += 10;
      this.zoomBy(this.pinch / now);
      this.pinch = now;
    }
  }

  up(e: PointerEvent) {
    const wasTap = this.pointers.size === 1 && this.moved < 8;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = 0;
    if (!wasTap || e.type === 'pointercancel') return;
    const hit = (document.elementFromPoint(e.clientX, e.clientY) as Element | null)?.getAttribute('data-a');
    if (hit) {
      this.selected.set(this.selected() === hit ? null : hit);
    } else this.selected.set(null);
  }

  wheel(e: WheelEvent) {
    e.preventDefault();
    this.zoomBy(e.deltaY > 0 ? 1.15 : 0.87);
  }

  private spread() {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  }

  private unitsPerPx() {
    const el = this.svg()?.nativeElement;
    const w = el?.getBoundingClientRect().width || 1000;
    return this.vb().w / w;
  }

  private setView(v: Box) {
    const w = Math.max(60, Math.min(1000, v.w)), h = (w * 520) / 1000;
    const x = Math.max(-w * 0.2, Math.min(1000 - w * 0.8, v.x)), y = Math.max(-h * 0.2, Math.min(520 - h * 0.8, v.y));
    this.vb.set({ x, y, w, h });
  }

  private animateTo(to: Box) {
    const from = this.vb(), t0 = performance.now(), dur = 450;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      this.setView({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, w: from.w + (to.w - from.w) * e, h: from.h + (to.h - from.h) * e });
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private key() {
    return `gm_world_marked_${this.auth.user()?.id ?? 'me'}`;
  }
}

function fold(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
