import { Directive, ElementRef, HostListener, inject, input } from '@angular/core';

/**
 * Makes a glass surface react to the finger: the specular highlight follows the touch point
 * and the card tilts slightly in 3D. Uses CSS variables only, so it never triggers layout.
 */
@Directive({ selector: '[gmSheen]', host: { style: 'transform-style: preserve-3d' } })
export class SheenDirective {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Max tilt in degrees (0 disables tilt). */
  readonly tilt = input(4, { alias: 'gmSheen', transform: (v: unknown) => (v === '' || v == null ? 4 : Number(v)) });
  private frame = 0;

  @HostListener('pointermove', ['$event'])
  @HostListener('pointerdown', ['$event'])
  move(e: PointerEvent) {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      const el = this.el.nativeElement;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', `${x * 100}%`);
      el.style.setProperty('--my', `${y * 100}%`);
      const t = this.tilt();
      if (t) el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * t}deg) rotateY(${(x - 0.5) * t}deg)`;
    });
  }

  @HostListener('pointerleave')
  @HostListener('pointerup')
  @HostListener('pointercancel')
  reset() {
    cancelAnimationFrame(this.frame);
    const el = this.el.nativeElement;
    el.style.transition = 'transform .6s cubic-bezier(.34,1.56,.64,1)';
    el.style.transform = '';
    el.style.removeProperty('--mx');
    el.style.removeProperty('--my');
    setTimeout(() => (el.style.transition = ''), 600);
  }
}
