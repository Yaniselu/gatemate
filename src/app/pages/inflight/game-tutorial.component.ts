import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { ScoresService } from './scores.service';

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
        <div class="sheet" [style.--c]="color()" (click)="$event.stopPropagation()">
          <div class="hero">
            <span class="glow g1"></span>
            <span class="glow g2"></span>
            <span class="dots"></span>
            <span class="ring r1"></span>
            <span class="ring r2"></span>
            <span class="badge"><ion-icon [name]="icon()" /></span>
            <div class="titles">
              <span class="kicker">{{ 'How to play' | t }}</span>
              <h2>{{ title() | t }}</h2>
            </div>
            @if (bestValue() !== null) {
              <span class="best"><ion-icon name="trophy" /> {{ scoreLabel() | t }} {{ bestValue() }}</span>
            }
          </div>
          <ol>
            @for (s of steps(); track s.text; let i = $index) {
              <li [style.--i]="i">
                <span class="num">{{ i + 1 }}</span>
                <span class="txt">{{ s.text | t }}</span>
                <ion-icon class="ic" [name]="s.icon" />
              </li>
            }
          </ol>
          <button class="play" (click)="close()"><ion-icon name="play" /> {{ 'Let’s play' | t }}</button>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: contents; }
    .veil { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: flex-end; justify-content: center;
      padding: 16px 14px calc(14px + env(safe-area-inset-bottom)); background: rgba(3, 8, 20, .62); animation: gm-fade-in .2s ease both; }
    .sheet { width: 100%; max-width: 440px; overflow: hidden; border-radius: 30px; background: var(--gm-card-bg); border: 1px solid var(--gm-card-border);
      color: var(--gm-ink); box-shadow: 0 30px 70px rgba(0, 0, 0, .45); animation: gm-fade-up .38s var(--gm-ease-out) both; }
    .hero { position: relative; isolation: isolate; overflow: hidden; display: flex; align-items: flex-end; gap: 14px; min-height: 150px; padding: 22px 20px 18px; color: #fff;
      background: linear-gradient(135deg, color-mix(in srgb, var(--c) 92%, #fff) 0%, var(--c) 45%, color-mix(in srgb, var(--c) 55%, #050b1a) 100%); }
    .glow { position: absolute; z-index: -1; border-radius: 50%; filter: blur(30px); }
    .g1 { width: 220px; height: 220px; right: -60px; top: -90px; background: rgba(255, 255, 255, .35); animation: drift 7s ease-in-out infinite; }
    .g2 { width: 180px; height: 180px; left: -50px; bottom: -110px; background: color-mix(in srgb, var(--c) 40%, #7c5cff); opacity: .8; animation: drift 9s ease-in-out infinite reverse; }
    .dots { position: absolute; inset: 0; z-index: -1; opacity: .22;
      background-image: radial-gradient(rgba(255, 255, 255, .9) 1px, transparent 1.4px); background-size: 14px 14px;
      mask-image: linear-gradient(120deg, transparent 20%, #000 75%); -webkit-mask-image: linear-gradient(120deg, transparent 20%, #000 75%); }
    .ring { position: absolute; z-index: -1; border-radius: 50%; border: 1.5px solid rgba(255, 255, 255, .22); }
    .r1 { width: 170px; height: 170px; right: -36px; top: -40px; }
    .r2 { width: 250px; height: 250px; right: -76px; top: -80px; border-color: rgba(255, 255, 255, .12); }
    .badge { flex: none; width: 64px; height: 64px; border-radius: 21px; display: grid; place-items: center; font-size: 32px;
      background: rgba(255, 255, 255, .18); border: 1px solid rgba(255, 255, 255, .35); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .5), 0 12px 26px rgba(0, 0, 0, .22);
      -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); animation: float 4s ease-in-out infinite; }
    .titles { flex: 1; min-width: 0; }
    .kicker { display: block; color: #fff; font-size: 11.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; opacity: .85; }
    h2 { margin: 2px 0 0; font-size: 25px; font-weight: 900; line-height: 1.1; color: #fff; text-shadow: 0 2px 12px rgba(0, 0, 0, .2); }
    .best { position: absolute; top: 14px; right: 14px; display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 999px;
      font-size: 12.5px; font-weight: 800; background: rgba(0, 0, 0, .22); border: 1px solid rgba(255, 255, 255, .25); }
    .best ion-icon { color: #ffd166; }
    ol { margin: 0; padding: 16px 18px 6px; list-style: none; display: flex; flex-direction: column; gap: 10px; }
    li { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 16px; background: var(--gm-surface);
      animation: gm-fade-up .35s var(--gm-ease-out) both; animation-delay: calc(90ms + var(--i) * 70ms); }
    .num { flex: none; width: 26px; height: 26px; border-radius: 9px; display: grid; place-items: center; font-size: 13px; font-weight: 900; color: #fff;
      background: linear-gradient(135deg, color-mix(in srgb, var(--c) 80%, #fff), var(--c)); }
    .txt { flex: 1; font-size: 14.5px; line-height: 1.38; color: var(--gm-ink-2); }
    .ic { flex: none; font-size: 19px; color: color-mix(in srgb, var(--c) 75%, var(--gm-ink)); }
    .play { display: flex; align-items: center; justify-content: center; gap: 8px; width: calc(100% - 36px); height: 52px; margin: 12px 18px 18px; border-radius: 17px;
      font-size: 16.5px; font-weight: 850; color: #fff; background: linear-gradient(135deg, color-mix(in srgb, var(--c) 85%, #fff), var(--c) 55%, color-mix(in srgb, var(--c) 70%, #050b1a));
      box-shadow: 0 14px 28px color-mix(in srgb, var(--c) 40%, transparent), inset 0 1px 0 rgba(255, 255, 255, .35); }
    .play:active { transform: scale(.98); }
    @keyframes float { 50% { transform: translateY(-5px) rotate(-3deg); } }
    @keyframes drift { 50% { transform: translate(-14px, 12px) scale(1.08); } }
    @media (prefers-reduced-motion: reduce) { .veil, .sheet, li, .badge, .glow { animation: none; } }
    :host-context(html.gm-lite) .glow { display: none; }
  `,
})
export class GameTutorialComponent implements OnInit {
  private scores = inject(ScoresService);
  readonly game = input.required<string>();
  readonly title = input.required<string>();
  readonly icon = input('game-controller-outline');
  readonly color = input('#0fb5c3');
  readonly scoreKey = input<string | null>(null);
  readonly scoreLabel = input('Best:');
  readonly steps = input.required<TutorialStep[]>();
  readonly done = output<void>();
  readonly opened = output<void>();
  readonly shown = signal(false);
  readonly bestValue = computed(() => {
    const k = this.scoreKey();
    const v = k ? this.scores.best()[k] : undefined;
    return v === undefined || v === null ? null : v;
  });

  ngOnInit() {
    void this.scores.load();
    if (!tutorialSeen(this.game())) this.shown.set(true);
  }

  open() {
    this.shown.set(true);
    this.opened.emit();
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
