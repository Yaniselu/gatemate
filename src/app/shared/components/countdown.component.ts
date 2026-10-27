import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, signal } from '@angular/core';

/** Live HH:MM:SS countdown with digits that roll when they change. */
@Component({
  selector: 'gm-countdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (remaining() > 0) {
      <div class="units">
        @for (u of units(); track u.label) {
          <div class="unit">
            <div class="digits">
              @for (d of u.value; track $index + ':' + d) {
                <span class="digit"><span class="roll">{{ d }}</span></span>
              }
            </div>
            <small>{{ u.label }}</small>
          </div>
        }
      </div>
    } @else {
      <div class="done">{{ doneLabel() }}</div>
    }
  `,
  styles: `
    :host { display: block; }
    .units { display: flex; gap: 10px; }
    .unit { text-align: center; }
    .digits { display: flex; gap: 2px; }
    .digit {
      position: relative; overflow: hidden; width: 0.66em; height: 1.2em;
      font-variant-numeric: tabular-nums; font-weight: 800; font-size: var(--size, 30px); line-height: 1.2em;
    }
    .roll { position: absolute; inset: 0; text-align: center; animation: roll .45s var(--gm-ease-out); }
    small { font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; opacity: .75; font-weight: 600; }
    .done { font-weight: 800; font-size: 20px; animation: gm-scale-in .5s var(--gm-ease-spring); }
    @keyframes roll { from { transform: translateY(-100%); opacity: 0; } to { transform: none; opacity: 1; } }
  `,
})
export class CountdownComponent {
  readonly target = input.required<string>();
  readonly doneLabel = input('Now');
  private now = signal(Date.now());

  readonly remaining = computed(() => Math.max(0, new Date(this.target()).getTime() - this.now()));
  readonly units = computed(() => {
    const s = Math.floor(this.remaining() / 1000);
    const d = Math.floor(s / 86400);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const parts = [
      { label: 'hrs', value: pad(Math.floor((s % 86400) / 3600)) },
      { label: 'min', value: pad(Math.floor((s % 3600) / 60)) },
      { label: 'sec', value: pad(s % 60) },
    ];
    return d > 0 ? [{ label: 'days', value: String(d) }, ...parts.slice(0, 2)] : parts;
  });

  constructor() {
    const id = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }
}
