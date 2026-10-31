import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { Flight } from '../../core/models';
import { ClockPipe, ShortDatePipe } from '../pipes/time.pipes';
import { TranslatePipe } from '../../core/i18n/i18n.service';

@Component({
  selector: 'gm-boarding-pass',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonIcon, ClockPipe, ShortDatePipe],
  template: `
    <button class="card" [class.flipped]="flipped()" (click)="flip()" [attr.aria-label]="flipped() ? ('Show flight details' | t) : ('Show boarding code' | t)">
      <div class="face front">
        <div class="top">
          <div class="airline"><span class="logo">{{ flight().airlineCode }}</span>{{ flight().airline }}</div>
          <span class="cabin">{{ flight().cabin }}</span>
        </div>
        <div class="route">
          <div>
            <div class="code">{{ flight().from.code }}</div>
            <div class="city">{{ flight().from.city }}</div>
          </div>
          <div class="mid">
            <span class="line"></span>
            <ion-icon name="airplane" />
            <span class="line"></span>
          </div>
          <div class="right">
            <div class="code">{{ flight().to.code }}</div>
            <div class="city">{{ flight().to.city }}</div>
          </div>
        </div>
        <div class="perf"><span></span></div>
        <div class="grid">
          <div><small>{{ 'Passenger' | t }}</small><b>{{ flight().passengerName }}</b></div>
          <div><small>{{ 'Flight' | t }}</small><b>{{ flight().number }}</b></div>
          <div><small>{{ 'Date' | t }}</small><b>{{ flight().departure | shortDate: false : flight().from.timezone }}</b></div>
          <div><small>{{ 'Boarding' | t }}</small><b>{{ flight().boardingTime | clock: flight().from.timezone }}</b></div>
          <div><small>{{ 'Gate' | t }}</small><b>{{ flight().gate ?? ('TBA' | t) }}</b></div>
          <div><small>{{ 'Seat' | t }}</small><b>{{ flight().seat ?? '—' }}</b></div>
        </div>
        <div class="hint"><ion-icon name="sync-outline" /> {{ 'Tap to show code' | t }}</div>
      </div>
      <div class="face back">
        @if (real(); as q) {
          <div class="code-box real">
            <svg [attr.viewBox]="'0 0 ' + q.size + ' ' + q.size" shape-rendering="crispEdges" role="img" [attr.aria-label]="'Airline barcode' | t">
              <rect [attr.width]="q.size" [attr.height]="q.size" fill="#fff" />
              <path [attr.d]="q.path" fill="#000" />
            </svg>
          </div>
          <div class="who">{{ flight().passengerName }}@if (flight().seat) { · {{ 'Seat' | t }} {{ flight().seat }} }</div>
        } @else {
          <div class="code-box">
            @for (row of matrix(); track $index) {
              <div class="row">
                @for (cell of row; track $index) {
                  <i [class.on]="cell"></i>
                }
              </div>
            }
          </div>
        }
        <div class="ref">{{ 'Booking ref' | t }} <b class="selectable">{{ flight().bookingRef || '—' }}</b></div>
        @if (real()) {
          <p class="note ok"><ion-icon name="shield-checkmark" /> {{ 'This is the airline’s barcode from the scanned pass. Turn up the brightness at security and the gate.' | t }}</p>
        } @else {
          <p class="note">{{ 'Show the airline’s original boarding pass at security and the gate. Increase screen brightness for scanning.' | t }}</p>
        }
      </div>
    </button>
  `,
  styleUrl: './boarding-pass.component.scss',
})
export class BoardingPassComponent {
  readonly flight = input.required<Flight>();
  readonly flipped = signal(false);
  readonly real = signal<{ size: number; path: string } | null>(null);

  constructor() {
    effect(() => {
      const code = this.flight().barcode;
      this.real.set(null);
      if (code) void qr(code).then((q) => this.flight().barcode === code && this.real.set(q)).catch(() => {});
    });
  }

  readonly matrix = computed(() => {
    const seed = `${this.flight().bookingRef}${this.flight().number}${this.flight().seat}`;
    let h = 2166136261;
    const rows: boolean[][] = [];
    for (let r = 0; r < 21; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < 21; c++) {
        h ^= seed.charCodeAt((r * 21 + c) % seed.length) + r * 7 + c;
        h = Math.imul(h, 16777619);
        const finder = (r < 7 && c < 7) || (r < 7 && c > 13) || (r > 13 && c < 7);
        const ring = finder && (r % 20 === 0 || c % 20 === 0 || r === 6 || c === 6 || r === 14 || c === 14 || (r > 1 && r < 5 && ((c > 1 && c < 5) || (c > 15 && c < 19))) || (r > 15 && r < 19 && c > 1 && c < 5));
        row.push(finder ? ring : (h >>> 7) % 2 === 0);
      }
      rows.push(row);
    }
    return rows;
  });

  flip() {
    this.flipped.update((v) => !v);
  }
}

async function qr(text: string): Promise<{ size: number; path: string }> {
  const { QRCodeWriter, BarcodeFormat, EncodeHintType } = await import('@zxing/library');
  const hints = new Map();
  hints.set(EncodeHintType.MARGIN, 2);
  const m = new QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 0, 0, hints);
  const size = m.getWidth();
  let path = '';
  for (let y = 0; y < m.getHeight(); y++) {
    for (let x = 0; x < size; x++) {
      if (m.get(x, y)) {
        let run = 1;
        while (x + run < size && m.get(x + run, y)) run++;
        path += `M${x} ${y}h${run}v1h-${run}z`;
        x += run - 1;
      }
    }
  }
  return { size, path };
}
