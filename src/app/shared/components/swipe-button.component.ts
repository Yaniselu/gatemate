import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { PlatformService } from '../../core/services/platform.service';

/**
 * Slide-to-confirm control. Drag the thumb to the right end to trigger `completed`.
 * Keyboard and screen-reader users can press the thumb (Enter/Space) instead.
 */
@Component({
  selector: 'gm-swipe-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon],
  template: `
    <div class="track" #track [class.done]="done()" [class.dragging]="dragging()" [style.--p]="progress()">
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
      -webkit-backdrop-filter: blur(24px) saturate(180%); backdrop-filter: blur(24px) saturate(180%);
      box-shadow: 0 20px 44px rgba(3, 70, 82, .3), inset 0 1.5px 0 rgba(255,255,255,.75), inset 0 -10px 24px rgba(255,255,255,.08);
      overflow: hidden; user-select: none;
    }
    .fill {
      position: absolute; inset: 0; border-radius: inherit;
      background: linear-gradient(90deg, rgba(255,255,255,.0), rgba(255,255,255,.35));
      transform-origin: left; transform: scaleX(var(--p));
    }
    .label {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      padding-left: 40px; font-size: 18px; font-weight: 700; letter-spacing: .01em; color: #fff;
      opacity: calc(1 - var(--p) * 1.6);
      background: linear-gradient(100deg, rgba(255,255,255,.82) 20%, #fff 40%, rgba(255,255,255,.82) 60%) 0 0 / 250% 100%;
      filter: drop-shadow(0 1px 6px rgba(3,70,82,.35));
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
      cursor: grab; touch-action: none;
    }
    .thumb ion-icon { transform: rotate(calc(var(--p) * -20deg)); transition: transform .3s; }
    .dragging .thumb { transition: none; cursor: grabbing; scale: 1.06; }
    .done .thumb { color: #fff; background: linear-gradient(135deg, #22c7d3, #0a93a6); }
    .thumb:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
    @keyframes shimmer { from { background-position: 100% 0; } to { background-position: -150% 0; } }
    @keyframes chev { 0%, 100% { opacity: .25; transform: translateX(0); } 50% { opacity: 1; transform: translateX(3px); } }
  `,
})
export class SwipeButtonComponent {
  private platform = inject(PlatformService);
  readonly label = input('Get started');
  readonly icon = input('airplane');
  readonly completed = output<void>();

  private track = viewChild.required<ElementRef<HTMLElement>>('track');
  readonly progress = signal(0);
  readonly dragging = signal(false);
  readonly done = signal(false);
  private lastTick = 0;

  start(e: PointerEvent) {
    if (this.done()) return;
    const track = this.track().nativeElement;
    const thumb = e.currentTarget as HTMLElement;
    thumb.setPointerCapture(e.pointerId);
    const max = track.clientWidth - thumb.offsetWidth - 12;
    track.style.setProperty('--max', `${max}px`);
    const startX = e.clientX - this.progress() * max;
    this.dragging.set(true);
    this.platform.tap();

    const move = (ev: PointerEvent) => {
      const p = Math.max(0, Math.min(1, (ev.clientX - startX) / max));
      this.progress.set(p);
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
      this.dragging.set(false);
      if (this.progress() > 0.82) this.complete();
      else this.progress.set(0);
    };
    thumb.addEventListener('pointermove', move);
    thumb.addEventListener('pointerup', end);
    thumb.addEventListener('pointercancel', end);
  }

  complete() {
    if (this.done()) return;
    const track = this.track().nativeElement;
    track.style.setProperty('--max', `${track.clientWidth - 70}px`);
    this.progress.set(1);
    this.done.set(true);
    this.platform.success();
    setTimeout(() => this.completed.emit(), 250);
  }
}
