import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Shimmering placeholder. Compose several to mirror the layout that is loading. */
@Component({
  selector: 'gm-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  host: {
    'aria-hidden': 'true',
    '[style.width]': 'width()',
    '[style.height]': 'height()',
    '[style.border-radius]': 'radius()',
  },
  styles: `
    :host {
      display: block;
      position: relative;
      overflow: hidden;
      background: #edf2f6;
    }
    :host::after {
      content: '';
      position: absolute;
      inset: 0;
      transform: translateX(-100%);
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.85), transparent);
      animation: gm-shimmer 1.3s ease-in-out infinite;
    }
  `,
})
export class SkeletonComponent {
  readonly width = input('100%');
  readonly height = input('14px');
  readonly radius = input('8px');
}
