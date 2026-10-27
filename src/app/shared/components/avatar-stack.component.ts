import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Traveller } from '../../core/models';

@Component({
  selector: 'gm-avatar-stack',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (t of people().slice(0, max()); track t.id; let i = $index) {
      <span class="av" [style.background]="t.color" [style.--i]="i" [attr.title]="t.name">{{ t.initials }}</span>
    }
    @if (people().length > max()) {
      <span class="av more">+{{ people().length - max() }}</span>
    }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; }
    .av {
      flex: none; width: var(--size, 30px); height: var(--size, 30px); border-radius: 50%; letter-spacing: -.02em; position: relative; z-index: calc(10 - var(--i, 0));
      display: inline-flex; align-items: center; justify-content: center;
      color: #fff; font-size: 11px; font-weight: 700; border: 2px solid #fff;
      margin-left: -7px;
      animation: gm-pop .5s var(--gm-ease-spring) both; animation-delay: calc(var(--i) * 70ms);
    }
    .av:first-child { margin-left: 0; }
    .more { background: #e9eef3; color: var(--gm-ink-2); }
  `,
})
export class AvatarStackComponent {
  readonly people = input.required<Traveller[]>();
  readonly max = input(4);
}
