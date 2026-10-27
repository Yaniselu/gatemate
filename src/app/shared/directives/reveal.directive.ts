import { Directive, ElementRef, inject, input, OnDestroy, OnInit } from '@angular/core';

/** Fades/slides an element in the first time it scrolls into view. `gmReveal="2"` sets the stagger index. */
@Directive({
  selector: '[gmReveal]',
  host: { class: 'gm-reveal', '[style.--i]': 'index()' },
})
export class RevealDirective implements OnInit, OnDestroy {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly index = input<number | string>(0, { alias: 'gmReveal' });
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    if (typeof IntersectionObserver === 'undefined') {
      this.el.nativeElement.classList.add('is-visible');
      return;
    }
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            this.observer?.unobserve(e.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -24px 0px' },
    );
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
