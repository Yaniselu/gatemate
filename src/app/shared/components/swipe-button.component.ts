import { ChangeDetectionStrategy, Component, ElementRef, inject, input, NgZone, output, signal, viewChild } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { PlatformService } from '../../core/services/platform.service';

@Component({
  selector: 'gm-swipe-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon],
  template: `
    <div class="track" #track [class.done]="done()" [class.dragging]="dragging()">
      <div class="fill"></div>
      <span class="label" aria-hidden="true">{{ label() }}</span>
      <span class="chevrons" aria-hidden="true"><ion-icon name="chevron-forward" /><ion-icon name="chevron-forward" /><ion-icon name="chevron-forward" /></span>
      <button
        class="thumb"
        type="button"
        [attr.aria-label]="label() + ' (swipe right or press)'"
        (pointerdown)="start($event)"
        (keydown.enter)="complete()"
        (keydown.space)="$event.preventDefault(); complete()"
        [disabled]="done()"
      >
        <ion-icon [name]="done() ? 'checkmark' : icon()" />
      </button>
    </div>
  `,
  styles: `
    :host { display: block; touch-action: pan-y; }
    .track {
      --thumb: 58px;
      position: relative; height: 70px; border-radius: 35px; padding: 6px;
      background: linear-gradient(160deg, rgba(255,255,255,.34), rgba(255,255,255,.14));
      border: 1px solid rgba(255,255,255,.55);
      --p: 0;
      -webkit-backdrop-filter: blur(14px) saturate(160%); backdrop-filter: blur(14px) saturate(160%);
      transform: translateZ(0);
      box-shadow: 0 20px 44px rgba(3, 70, 82, .3), inset 0 1.5px 0 rgba(255,255,255,.75), inset 0 -10px 24px rgba(255,255,255,.08);
      overflow: hidden; user-select: none;
    }
    .fill {
      position: absolute; inset: 0; border-radius: inherit;
      background: linear-gradient(90deg, rgba(255,255,255,.0), rgba(255,255,255,.35));
      transform-origin: left; transform: scaleX(var(--p)); will-change: transform;
    }
    .label {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      padding-left: 40px; font-size: 18px; font-weight: 700; letter-spacing: .01em; color: #fff;
      opacity: calc(1 - var(--p) * 1.6);
      background: linear-gradient(100deg, rgba(255,255,255,.82) 20%, #fff 40%, rgba(255,255,255,.82) 60%) 0 0 / 250% 100%;
      -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
      animation: shimmer 2.6s linear infinite;
    }
    .chevrons {
      position: absolute; right: 22px; top: 50%; transform: translateY(-50%);
      display: flex; color: #fff; font-size: 16px; opacity: calc(.9 - var(--p) * 2);
    }
    .chevrons ion-icon { margin-left: -6px; animation: chev 1.5s ease-in-out infinite; }
    .chevrons ion-icon:nth-child(2) { animation-delay: .15s; }
    .chevrons ion-icon:nth-child(3) { animation-delay: .3s; }
    .thumb {
      position: relative; z-index: 2; width: var(--thumb); height: var(--thumb); border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: var(--gm-accent-strong); font-size: 26px;
      background: radial-gradient(circle at 35% 25%, #fff, #e8fbfc 70%);
      box-shadow: 0 10px 24px rgba(3, 70, 82, .35), inset 0 -3px 8px rgba(15,181,195,.18), inset 0 2px 0 #fff;
      transform: translateX(calc(var(--p) * var(--max, 260px)));
      transition: transform .55s var(--gm-ease-spring);
      will-change: transform; cursor: grab; touch-action: none;
    }
    .thumb ion-icon { transform: rotate(calc(var(--p) * -20deg)); transition: transform .3s; }
    .dragging .thumb { transition: none; cursor: grabbing; scale: 1.06; }
    .done .thumb { color: #fff; background: linear-gradient(135deg, #0fa8b6, #08808e); }
    .thumb:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
    @keyframes shimmer { from { background-position: 100% 0; } to { background-position: -150% 0; } }
    @keyframes chev { 0%, 100% { opacity: .25; transform: translateX(0); } 50% { opacity: 1; transform: translateX(3px); } }
  `,
})
export class SwipeButtonComponent {
  private platform = inject(PlatformService);
  private zone = inject(NgZone);
  readonly label = input('Get started');
  readonly icon = input('airplane');
  readonly completed = output<void>();

  private track = viewChild.required<ElementRef<HTMLElement>>('track');
  readonly dragging = signal(false);
  readonly done = signal(false);
  private p = 0;
  private lastTick = 0;
  private frame = 0;

  private paint(p: number) {
    this.p = p;
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.track().nativeElement.style.setProperty('--p', String(this.p));
    });
  }

  start(e: PointerEvent) {
    if (this.done()) return;
    const track = this.track().nativeElement;
    const thumb = e.currentTarget as HTMLElement;
    thumb.setPointerCapture(e.pointerId);
    const max = track.clientWidth - thumb.offsetWidth - 12;
    track.style.setProperty('--max', `${max}px`);
    const startX = e.clientX - this.p * max;
    this.dragging.set(true);
    this.platform.tap();

    this.zone.runOutsideAngular(() => {
      const move = (ev: PointerEvent) => {
        const p = Math.max(0, Math.min(1, (ev.clientX - startX) / max));
        this.paint(p);
        const tick = Math.floor(p * 5);
        if (tick !== this.lastTick) {
          this.lastTick = tick;
          this.platform.selection();
        }
      };
      const end = () => {
        thumb.removeEventListener('pointermove', move);
        thumb.removeEventListener('pointerup', end);
        thumb.removeEventListener('pointercancel', end);
        this.zone.run(() => {
          this.dragging.set(false);
          if (this.p > 0.82) this.complete();
          else this.paint(0);
        });
      };
      thumb.addEventListener('pointermove', move, { passive: true });
      thumb.addEventListener('pointerup', end);
      thumb.addEventListener('pointercancel', end);
    });
  }

  complete() {
    if (this.done()) return;
    const track = this.track().nativeElement;
    track.style.setProperty('--max', `${track.clientWidth - 70}px`);
    this.paint(1);
    this.done.set(true);
    this.platform.success();
    setTimeout(() => this.completed.emit(), 250);
  }
}
