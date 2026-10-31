import { AfterViewInit, ChangeDetectionStrategy, Component, computed, ElementRef, input, viewChild } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { Flight } from '../../core/models';
import { TranslatePipe } from '../../core/i18n/i18n.service';

interface Cabin {
  cols: string[];
  rows: number;
  exits: number[];
  wing: [number, number];
  name: string;
}

const CELL = 22, NOSE = 92, TAIL = 70;

function cabinFor(aircraft: string | undefined, seatRow: number): Cabin {
  const a = (aircraft ?? '').toUpperCase();
  if (/A33|A34|A35|A38|777|787|767|747|B77|B78/.test(a)) {
    const rows = Math.max(42, seatRow + 3);
    return { cols: ['A', 'B', 'C', '|', 'D', 'E', 'F', '|', 'H', 'J', 'K'], rows, exits: [1, 12, 26, rows], wing: [14, 26], name: 'wide' };
  }
  if (/A321|737 MAX 10|739|73J/.test(a)) {
    const rows = Math.max(38, seatRow + 2);
    return { cols: ['A', 'B', 'C', '|', 'D', 'E', 'F'], rows, exits: [1, 11, 12, 25, rows], wing: [11, 20], name: 'long' };
  }
  const rows = Math.max(30, seatRow + 2);
  return { cols: ['A', 'B', 'C', '|', 'D', 'E', 'F'], rows, exits: [1, 11, 12, rows], wing: [9, 17], name: 'narrow' };
}

@Component({
  selector: 'gm-seat-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, TranslatePipe],
  template: `
    @if (seat(); as s) {
      <section class="card">
        <header>
          <span class="ic"><ion-icon name="grid-outline" /></span>
          <div><b>{{ 'Seat map' | t }}</b><small>{{ flight().aircraft ?? '' }}</small></div>
          <span class="mine">{{ s.row }}{{ s.letter }}</span>
        </header>

        <div class="scroll" #scroll>
          <svg [attr.width]="width()" [attr.height]="height()" [attr.viewBox]="'0 0 ' + width() + ' ' + height()" role="img" [attr.aria-label]="('Your seat' | t) + ' ' + s.row + s.letter">
            <defs>
              <linearGradient id="hull" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#f8fafc" /><stop offset=".5" stop-color="#eef2f7" /><stop offset="1" stop-color="#e2e8f0" />
              </linearGradient>
              <radialGradient id="pulse"><stop offset="0" stop-color="#22c7d3" stop-opacity=".55" /><stop offset="1" stop-color="#22c7d3" stop-opacity="0" /></radialGradient>
            </defs>
            <path [attr.d]="wingPath(-1)" fill="#cbd5e1" />
            <path [attr.d]="wingPath(1)" fill="#cbd5e1" />
            <path [attr.d]="hullPath()" fill="url(#hull)" stroke="#94a3b8" stroke-width="1.5" />
            <path [attr.d]="'M ' + (18) + ' ' + (height() / 2 - 9) + ' q 8 9 0 18'" fill="none" stroke="#334155" stroke-width="4" stroke-linecap="round" />
            <rect [attr.x]="NOSE - 34" [attr.y]="top() + 4" width="26" [attr.height]="cabinH() - 8" rx="5" fill="#e2e8f0" />
            <text [attr.x]="NOSE - 21" [attr.y]="height() / 2 + 3" class="lab" text-anchor="middle">WC</text>
            <rect [attr.x]="NOSE + cabin().rows * CELL + 6" [attr.y]="top() + 4" width="26" [attr.height]="cabinH() - 8" rx="5" fill="#e2e8f0" />
            <text [attr.x]="NOSE + cabin().rows * CELL + 19" [attr.y]="height() / 2 + 3" class="lab" text-anchor="middle">WC</text>

            @for (e of cabin().exits; track e) {
              <g>
                <rect [attr.x]="rowX(e) - 3" [attr.y]="top() - 7" width="16" height="5" rx="2" fill="#16a34a" />
                <rect [attr.x]="rowX(e) - 3" [attr.y]="top() + cabinH() + 2" width="16" height="5" rx="2" fill="#16a34a" />
              </g>
            }

            @for (r of rowList(); track r) {
              @if (r % 5 === 0 || r === 1) { <text [attr.x]="rowX(r) + 8" [attr.y]="top() + cabinH() + 20" class="num" text-anchor="middle">{{ r }}</text> }
              @for (c of seatCols(); track c.letter) {
                <rect [attr.x]="rowX(r)" [attr.y]="c.y" width="16" height="15" rx="4"
                      [class.me]="r === s.row && c.letter === s.letter" [class.exit]="isExit(r)" class="seat" />
              }
            }
            @for (c of seatCols(); track c.letter) {
              <text [attr.x]="NOSE - 46" [attr.y]="c.y + 11" class="col" text-anchor="middle">{{ c.letter }}</text>
            }
            <circle [attr.cx]="rowX(s.row) + 8" [attr.cy]="seatY(s.letter) + 7.5" r="22" fill="url(#pulse)" class="ring" />
            <g [attr.transform]="'translate(' + (rowX(s.row) + 8) + ' ' + (seatY(s.letter) < height() / 2 ? seatY(s.letter) - 14 : seatY(s.letter) + 30) + ')'">
              <rect x="-22" y="-12" width="44" height="18" rx="9" fill="#0f172a" />
              <text x="0" y="1" class="tag" text-anchor="middle">{{ s.row }}{{ s.letter }}</text>
            </g>
          </svg>
        </div>

        <div class="facts">
          <span><ion-icon [name]="s.kind === 'window' ? 'sunny-outline' : s.kind === 'aisle' ? 'walk-outline' : 'people-outline'" />{{ kindLabel(s.kind) | t }}</span>
          <span><ion-icon name="swap-horizontal" />{{ (s.side === 'left' ? 'Left side' : 'Right side') | t }}</span>
          @if (s.overWing) { <span><ion-icon name="airplane-outline" />{{ 'Over the wing' | t }}</span> }
          @if (s.exitRow) { <span class="hl"><ion-icon name="exit-outline" />{{ 'Exit row: extra legroom' | t }}</span> }
          @else { <span><ion-icon name="exit-outline" />{{ '{n} rows to the nearest exit' | t: { n: s.toExit } }}</span> }
          <span><ion-icon name="navigate-outline" />{{ zoneLabel(s.zone) | t }}</span>
        </div>
        <p class="fine">{{ 'Typical layout for this aircraft. Count the rows to your nearest exit when you board.' | t }}</p>
      </section>
    }
  `,
  styles: `
    :host { display: block; margin-top: 14px; }
    .card { padding: 14px 0 12px; border-radius: 24px; background: var(--gm-card-bg, #fff); border: 1px solid var(--gm-card-border, #e6eaef); box-shadow: 0 10px 30px rgba(15,23,42,.06); }
    header { display: flex; align-items: center; gap: 10px; padding: 0 16px 8px; }
    header b { display: block; font-size: 16px; font-weight: 800; }
    header small { font-size: 12px; color: var(--gm-ink-3); }
    .ic { width: 34px; height: 34px; border-radius: 11px; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #0fb5c3; background: rgba(15,181,195,.12); }
    .mine { margin-left: auto; padding: 6px 12px; border-radius: 999px; font-weight: 850; font-size: 15px; color: #fff; background: linear-gradient(135deg, #0fb5c3, #6366f1); }
    .scroll { overflow-x: auto; padding: 6px 12px; scrollbar-width: none; }
    .scroll::-webkit-scrollbar { display: none; }
    svg { display: block; }
    .seat { fill: #cbd5e1; }
    .seat.exit { fill: #bbf7d0; }
    .seat.me { fill: #0fb5c3; stroke: #0f172a; stroke-width: 1.5; }
    .ring { transform-box: fill-box; transform-origin: center; animation: pulse 1.8s ease-out infinite; }
    @keyframes pulse { from { transform: scale(.6); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }
    .lab { font-size: 8px; font-weight: 700; fill: #64748b; }
    .num { font-size: 9px; font-weight: 700; fill: #94a3b8; }
    .col { font-size: 9px; font-weight: 800; fill: #64748b; }
    .tag { font-size: 10.5px; font-weight: 850; fill: #fff; }
    .facts { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 16px 0; }
    .facts span { display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; border-radius: 999px; font-size: 12.5px; font-weight: 650; color: var(--gm-ink-2); background: var(--gm-surface); }
    .facts span.hl { color: #15803d; background: rgba(22,163,74,.12); }
    .facts ion-icon { font-size: 15px; }
    .fine { margin: 10px 16px 0; font-size: 11.5px; color: var(--gm-ink-3); }
    @media (prefers-reduced-motion: reduce) { .ring { animation: none; } }
  `,
})
export class SeatMapComponent implements AfterViewInit {
  readonly flight = input.required<Flight>();
  private scroll = viewChild<ElementRef<HTMLElement>>('scroll');
  protected readonly NOSE = NOSE;
  protected readonly CELL = CELL;

  private parsed = computed(() => {
    const m = /^(\d{1,2})\s*([A-K])$/i.exec((this.flight().seat ?? '').trim());
    return m ? { row: +m[1], letter: m[2].toUpperCase() } : null;
  });
  readonly cabin = computed(() => cabinFor(this.flight().aircraft, this.parsed()?.row ?? 1));
  readonly rowList = computed(() => Array.from({ length: this.cabin().rows }, (_, i) => i + 1));
  readonly cabinH = computed(() => this.cabin().cols.length * 17 + 4);
  readonly height = computed(() => this.cabinH() + 72);
  readonly width = computed(() => NOSE + this.cabin().rows * CELL + 40 + TAIL);
  readonly top = computed(() => (this.height() - this.cabinH()) / 2 - 4);

  readonly seatCols = computed(() => {
    const cols = [...this.cabin().cols].reverse();
    const out: { letter: string; y: number }[] = [];
    let y = this.top() + 4;
    for (const c of cols) {
      if (c === '|') {
        y += 13;
        continue;
      }
      out.push({ letter: c, y });
      y += 17;
    }
    return out;
  });

  readonly seat = computed(() => {
    const p = this.parsed();
    if (!p) return null;
    const cab = this.cabin();
    const letters = cab.cols.filter((c) => c !== '|');
    if (!letters.includes(p.letter)) return null;
    const idx = cab.cols.indexOf(p.letter);
    const kind = p.letter === letters[0] || p.letter === letters[letters.length - 1] ? 'window' : cab.cols[idx - 1] === '|' || cab.cols[idx + 1] === '|' ? 'aisle' : 'middle';
    const half = letters.indexOf(p.letter) < letters.length / 2;
    const toExit = Math.min(...cab.exits.map((e) => Math.abs(e - p.row)));
    const third = p.row / cab.rows;
    return {
      ...p, kind, side: half ? 'left' : 'right', toExit, exitRow: toExit === 0 && p.row !== 1,
      overWing: p.row >= cab.wing[0] && p.row <= cab.wing[1],
      zone: third < 0.34 ? 'front' : third < 0.67 ? 'middle' : 'rear',
    };
  });

  rowX(r: number) {
    return NOSE + (r - 1) * CELL;
  }

  seatY(letter: string) {
    return this.seatCols().find((c) => c.letter === letter)?.y ?? 0;
  }

  isExit(r: number) {
    return this.cabin().exits.includes(r) && r !== 1;
  }

  hullPath() {
    const h = this.height(), w = this.width(), t = this.top() - 10, b = this.top() + this.cabinH() + 10, mid = h / 2;
    return `M 6 ${mid} C 6 ${t + 6}, 40 ${t}, ${NOSE - 20} ${t} L ${w - TAIL} ${t} C ${w - 30} ${t}, ${w - 6} ${mid - 8}, ${w - 4} ${mid} C ${w - 6} ${mid + 8}, ${w - 30} ${b}, ${w - TAIL} ${b} L ${NOSE - 20} ${b} C 40 ${b}, 6 ${b - 6}, 6 ${mid} Z`;
  }

  wingPath(side: number) {
    const [a, b] = this.cabin().wing;
    const x0 = this.rowX(a) - 6, x1 = this.rowX(b) + CELL, y0 = side < 0 ? this.top() - 10 : this.top() + this.cabinH() + 10;
    const y1 = side < 0 ? 0 : this.height();
    return `M ${x0} ${y0} L ${x0 + (x1 - x0) * 0.75} ${y1} L ${x1 + 10} ${y1} L ${x1} ${y0} Z`;
  }

  kindLabel(k: string) {
    return k === 'window' ? 'Window seat' : k === 'aisle' ? 'Aisle seat' : 'Middle seat';
  }

  zoneLabel(z: string) {
    return z === 'front' ? 'Front of the cabin' : z === 'middle' ? 'Middle of the cabin' : 'Rear of the cabin';
  }

  ngAfterViewInit() {
    const s = this.seat(), el = this.scroll()?.nativeElement;
    if (s && el) el.scrollLeft = Math.max(0, this.rowX(s.row) - el.clientWidth / 2);
  }
}
