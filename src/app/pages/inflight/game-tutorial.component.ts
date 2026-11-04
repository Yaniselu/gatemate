import { ChangeDetectionStrategy, Component, input, OnInit, output, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe } from '../../core/i18n/i18n.service';

export interface TutorialStep {
  icon: string;
  text: string;
}

const KEY = 'gm_tutorial_';

export function tutorialSeen(game: string): boolean {
  try {
    return localStorage.getItem(KEY + game) === '1';
  } catch {
    return true;
  }
}

@Component({
  selector: 'gm-game-tutorial',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, TranslatePipe],
  template: `
    @if (shown()) {
      <div class="veil" role="dialog" aria-modal="true" [attr.aria-label]="'How to play' | t" (click)="close()">
        <div class="sheet" (click)="$event.stopPropagation()">
          <span class="badge"><ion-icon [name]="icon()" /></span>
          <span class="gm-label">{{ 'How to play' | t }}</span>
          <h2>{{ title() | t }}</h2>
          <ol>
            @for (s of steps(); track s.text; let i = $index) {
              <li [style.--i]="i"><span class="ic"><ion-icon [name]="s.icon" /></span><span>{{ s.text | t }}</span></li>
            }
          </ol>
          <button class="gm-btn" (click)="close()"><ion-icon name="play" /> {{ 'Let’s play' | t }}</button>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: contents; }
    .veil { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: flex-end; justify-content: center; padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
      background: rgba(4, 10, 22, .55); animation: gm-fade-in .2s ease both; }
    .sheet { width: 100%; max-width: 440px; padding: 22px 20px 18px; border-radius: 28px; background: var(--gm-card-bg); border: 1px solid var(--gm-card-border);
      color: var(--gm-ink); box-shadow: 0 30px 60px rgba(0,0,0,.35); animation: gm-fade-up .35s var(--gm-ease-out) both; }
    .badge { width: 52px; height: 52px; border-radius: 17px; display: grid; place-items: center; margin-bottom: 10px; font-size: 26px; color: #fff;
      background: linear-gradient(135deg, #22c7d3, #5b5bd6); box-shadow: 0 10px 24px rgba(34,199,211,.35); }
    h2 { margin: 2px 0 12px; font-size: 22px; font-weight: 850; }
    ol { margin: 0 0 18px; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; }
    li { display: flex; align-items: center; gap: 12px; font-size: 15px; line-height: 1.4; color: var(--gm-ink-2); animation: gm-fade-up .35s var(--gm-ease-out) both; animation-delay: calc(80ms + var(--i) * 60ms); }
    .ic { flex: none; width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; font-size: 18px; color: var(--gm-accent-strong); background: var(--gm-surface); }
    .gm-btn { width: 100%; }
    @media (prefers-reduced-motion: reduce) { .veil, .sheet, li { animation: none; } }
  `,
})
export class GameTutorialComponent implements OnInit {
  readonly game = input.required<string>();
  readonly title = input.required<string>();
  readonly icon = input('game-controller-outline');
  readonly steps = input.required<TutorialStep[]>();
  readonly done = output<void>();
  readonly shown = signal(false);

  ngOnInit() {
    if (!tutorialSeen(this.game())) this.shown.set(true);
  }

  open() {
    this.shown.set(true);
  }

  close() {
    this.shown.set(false);
    try {
      localStorage.setItem(KEY + this.game(), '1');
    } catch {
      return void this.done.emit();
    }
    this.done.emit();
  }
}
