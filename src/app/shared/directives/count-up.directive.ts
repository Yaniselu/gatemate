import { Directive, ElementRef, inject, input, effect, OnDestroy } from '@angular/core';
import { locale } from '../../core/i18n/i18n.service';

/** Animates a number from 0 to the target with an ease-out curve. */
@Directive({ selector: '[gmCountUp]' })
export class CountUpDirective implements OnDestroy {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly value = input.required<number>({ alias: 'gmCountUp' });
  readonly duration = input(1400);
  private frame = 0;

  constructor() {
    effect(() => this.run(this.value()));
  }

  private run(target: number) {
    cancelAnimationFrame(this.frame);
    const start = performance.now();
    const fmt = new Intl.NumberFormat(locale());
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / this.duration());
      const eased = 1 - Math.pow(1 - p, 4);
      this.el.nativeElement.textContent = fmt.format(Math.round(target * eased));
      if (p < 1) this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frame);
  }
}
