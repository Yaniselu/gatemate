import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { AchievementsService } from '../../core/services/achievements.service';
import { ConfettiService } from './confetti.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';

/** Celebrates a newly earned badge with a glass banner that drops in from the top. */
@Component({
  selector: 'gm-badge-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonIcon],
  template: `
    @if (a.unlocked()[0]; as b) {
      <button class="toast glass strong" [attr.data-tier]="b.tier" (click)="open()" role="status" aria-live="polite">
        <span class="medal"><ion-icon [name]="b.icon" /></span>
        <span class="txt"><small>Badge unlocked · +{{ b.xp }} XP</small><b>{{ b.title | t }}</b></span>
        <ion-icon name="chevron-forward" class="chev" />
      </button>
    }
  `,
  styles: `
    :host { position: fixed; left: 12px; right: 12px; top: calc(10px + env(safe-area-inset-top)); z-index: 99998; pointer-events: none; }
    .toast { pointer-events: auto; display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 14px 10px 10px; border-radius: 22px !important; text-align: left; color: var(--gm-ink); animation: drop .7s var(--gm-ease-spring); }
    @keyframes drop { from { transform: translateY(-140%) scale(.9); opacity: 0; } }
    .medal { flex: none; width: 48px; height: 48px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #fff; background: linear-gradient(135deg, #e7b98a, #b7703f); box-shadow: inset 0 1px 0 rgba(255,255,255,.5); animation: spin-in .9s var(--gm-ease-spring); position: relative; overflow: hidden; }
    .medal::after { content: ''; position: absolute; top: 0; left: -80%; width: 50%; height: 100%; background: linear-gradient(100deg, transparent, rgba(255,255,255,.7), transparent); transform: skewX(-20deg); animation: gm-shine 2.2s ease-in-out infinite .6s; }
    [data-tier='silver'] .medal { background: linear-gradient(135deg, #e6edf3, #8fa3b5); }
    [data-tier='gold'] .medal { background: linear-gradient(135deg, #ffd27a, #e09b1c); }
    @keyframes spin-in { from { transform: rotateY(180deg) scale(.4); } }
    .txt { flex: 1; min-width: 0; }
    .txt small { display: block; font-size: 11.5px; font-weight: 700; color: var(--gm-accent-strong); letter-spacing: .02em; }
    .txt b { font-size: 16px; }
    .chev { color: var(--gm-ink-3); }
  `,
})
export class BadgeToastComponent {
  protected a = inject(AchievementsService);
  private confetti = inject(ConfettiService);
  private router = inject(Router);
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      const b = this.a.unlocked()[0];
      clearTimeout(this.timer);
      if (!b) return;
      this.confetti.burst(0.5, 0.08, 70);
      this.timer = setTimeout(() => this.a.dismiss(), 3800);
    });
  }

  open() {
    this.a.dismiss();
    void this.router.navigateByUrl('/achievements');
  }
}
