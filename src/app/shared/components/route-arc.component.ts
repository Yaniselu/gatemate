import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';

/** Origin → destination arc; the plane glides along it to show live flight progress. */
@Component({
  selector: 'gm-route-arc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon],
  template: `
    <svg viewBox="0 0 300 90" preserveAspectRatio="none" aria-hidden="true">
      <path class="track" d="M10 80 Q150 -10 290 80" />
      <path class="flown" d="M10 80 Q150 -10 290 80" [style.stroke-dashoffset]="400 - 400 * t()" />
      <circle cx="10" cy="80" r="4.5" class="end" />
      <circle cx="290" cy="80" r="4.5" class="end hollow" />
    </svg>
    <div class="plane" [style.left.%]="pos().x" [style.top.%]="pos().y" [style.transform]="'translate(-50%, -50%) rotate(' + pos().angle + 'deg)'">
      <ion-icon name="airplane" />
    </div>
  `,
  styles: `
    :host { display: block; position: relative; height: 64px; }
    svg { width: 100%; height: 100%; overflow: visible; }
    path { fill: none; stroke-width: 2.2; stroke-linecap: round; }
    .track { stroke: currentColor; opacity: .28; stroke-dasharray: 2 7; }
    .flown { stroke: currentColor; stroke-dasharray: 400; transition: stroke-dashoffset .1s linear; }
    .end { fill: currentColor; }
    .end.hollow { fill: none; stroke: currentColor; stroke-width: 2; }
    .plane {
      position: absolute; width: 30px; height: 30px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: #fff; color: var(--gm-accent-strong);
      box-shadow: 0 6px 16px rgba(0,0,0,.18);
      font-size: 17px;
    }
    .plane ion-icon { transform: none; }
  `,
})
export class RouteArcComponent implements OnInit {
  /** 0 = at origin, 1 = landed. */
  readonly progress = input(0);
  readonly t = signal(0);
  private raf = 0;
  private destroyRef = inject(DestroyRef);

  readonly pos = computed(() => {
    const t = this.t();
    const p0 = { x: 10, y: 80 }, p1 = { x: 150, y: -10 }, p2 = { x: 290, y: 80 };
    const x = (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t ** 2 * p2.x;
    const y = (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t ** 2 * p2.y;
    const dx = 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
    const dy = 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
    return { x: (x / 300) * 100, y: (y / 90) * 100, angle: (Math.atan2(dy, dx) * 180) / Math.PI };
  });

  ngOnInit(): void {
    // Glide from the origin to the current progress on first render.
    const target = Math.max(0.04, Math.min(1, this.progress()));
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 1600);
      this.t.set(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
    this.destroyRef.onDestroy(() => cancelAnimationFrame(this.raf));
  }
}
