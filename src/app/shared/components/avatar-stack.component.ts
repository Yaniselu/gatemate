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
      width: var(--size, 30px); height: var(--size, 30px); border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      color: #fff; font-size: 11px; font-weight: 700; border: 2px solid #fff;
      margin-left: -9px; box-shadow: 0 2px 6px rgba(11,27,43,.12);
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
