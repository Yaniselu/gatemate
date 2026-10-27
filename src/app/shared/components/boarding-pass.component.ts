import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { Flight } from '../../core/models';
import { ClockPipe, ShortDatePipe } from '../pipes/time.pipes';

/** Tap-to-flip boarding pass. Front: journey details. Back: scannable code area. */
@Component({
  selector: 'gm-boarding-pass',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, ClockPipe, ShortDatePipe],
  template: `
    <button class="card" [class.flipped]="flipped()" (click)="flip()" [attr.aria-label]="flipped() ? 'Show flight details' : 'Show boarding code'">
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
          <div><small>Passenger</small><b>{{ flight().passengerName }}</b></div>
          <div><small>Flight</small><b>{{ flight().number }}</b></div>
          <div><small>Date</small><b>{{ flight().departure | shortDate: false }}</b></div>
          <div><small>Boarding</small><b>{{ flight().boardingTime | clock }}</b></div>
          <div><small>Gate</small><b>{{ flight().gate ?? 'TBA' }}</b></div>
          <div><small>Seat</small><b>{{ flight().seat ?? '—' }}</b></div>
        </div>
        <div class="hint"><ion-icon name="sync-outline" /> Tap to show code</div>
      </div>
      <div class="face back">
        <div class="code-box">
          @for (row of matrix(); track $index) {
            <div class="row">
              @for (cell of row; track $index) {
                <i [class.on]="cell"></i>
              }
            </div>
          }
        </div>
        <div class="ref">Booking ref <b class="selectable">{{ flight().bookingRef || '—' }}</b></div>
        <p class="note">Show the airline's original boarding pass at security and the gate. Increase screen brightness for scanning.</p>
      </div>
    </button>
  `,
  styleUrl: './boarding-pass.component.scss',
})
export class BoardingPassComponent {
  readonly flight = input.required<Flight>();
  readonly flipped = signal(false);

  // Deterministic visual code derived from the booking data (decorative until the real barcode payload is stored).
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
