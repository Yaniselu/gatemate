import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { PlatformService } from '../../core/services/platform.service';
import { ConfettiService } from '../../shared/components/confetti.service';
import { ScoresService } from './scores.service';
import { AchievementsService } from '../../core/services/achievements.service';

interface Card {
  id: number;
  icon: string;
  flipped: boolean;
  matched: boolean;
}

const ICONS = ['airplane', 'earth', 'ticket', 'bag-handle', 'compass', 'camera', 'sunny', 'map'];

@Component({
  selector: 'gm-memory',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/inflight" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>Boarding Memory</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <div class="page">
        <div class="hud">
          <div class="card"><span class="gm-label">Moves</span><b>{{ moves() }}</b></div>
          <div class="card"><span class="gm-label">Time</span><b>{{ seconds() }}s</b></div>
          <div class="card"><span class="gm-label">Best</span><b>{{ bestLabel() }}</b></div>
        </div>
        <div class="board">
          @for (c of cards(); track c.id; let i = $index) {
            <button class="tile" [class.flipped]="c.flipped || c.matched" [class.matched]="c.matched" [style.--i]="i" (click)="flip(i)" [attr.aria-label]="c.flipped || c.matched ? c.icon : 'Hidden card'">
              <span class="face back"><ion-icon name="airplane-outline" /></span>
              <span class="face front"><ion-icon [name]="c.icon" /></span>
            </button>
          }
        </div>
        @if (won()) {
          <div class="end card">
            <ion-icon name="trophy" class="trophy" />
            <h2>{{ record() ? 'New record!' : 'All matched!' }}</h2>
            <p>{{ moves() }} moves in {{ seconds() }} seconds.</p>
            <button class="gm-btn" (click)="reset()"><ion-icon name="refresh-outline" /> Play again</button>
          </div>
        } @else {
          <button class="gm-btn ghost" (click)="reset()"><ion-icon name="refresh-outline" /> Shuffle</button>
        }
      </div>
    </ion-content>
  `,
  styleUrl: './game-shell.scss',
  styles: `
    .board { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; margin-bottom: 16px; perspective: 900px; }
    .tile { position: relative; aspect-ratio: 1; padding: 0; background: none; transform-style: preserve-3d; transition: transform .5s var(--gm-ease-spring); animation: gm-scale-in .4s var(--gm-ease-spring) both; animation-delay: calc(var(--i) * 25ms); }
    .tile.flipped { transform: rotateY(180deg); }
    .face { position: absolute; inset: 0; border-radius: 16px; display: flex; align-items: center; justify-content: center; backface-visibility: hidden; -webkit-backface-visibility: hidden; font-size: 28px; }
    .back { background: linear-gradient(135deg, #12304a, #0a6e80); color: rgba(255,255,255,.35); box-shadow: 0 6px 14px rgba(8,36,56,.18), inset 0 1px 0 rgba(255,255,255,.2); }
    .front { transform: rotateY(180deg); background: #fff; color: var(--gm-accent-strong); border: 1px solid var(--gm-card-border); box-shadow: var(--gm-card-shadow); }
    .matched .front { background: var(--gm-accent-soft); animation: gm-pop .45s var(--gm-ease-spring); }
  `,
})
export class MemoryPage {
  private platform = inject(PlatformService);
  private confetti = inject(ConfettiService);
  protected scores = inject(ScoresService);
  private achievements = inject(AchievementsService);

  readonly cards = signal<Card[]>([]);
  readonly moves = signal(0);
  readonly seconds = signal(0);
  readonly won = signal(false);
  readonly record = signal(false);
  bestLabel() {
    const b = this.scores.best()['memory'];
    return b === undefined ? '—' : b;
  }
  private open: number[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    void this.scores.load();
    this.reset();
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  reset() {
    this.stop();
    const deck = [...ICONS, ...ICONS].map((icon, id) => ({ id, icon, flipped: false, matched: false }));
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    this.cards.set(deck);
    this.moves.set(0);
    this.seconds.set(0);
    this.won.set(false);
    this.open = [];
  }

  flip(i: number) {
    const c = this.cards()[i];
    if (c.flipped || c.matched || this.open.length === 2 || this.won()) return;
    if (!this.timer) this.timer = setInterval(() => this.seconds.update((s) => s + 1), 1000);
    this.platform.tap();
    this.update(i, { flipped: true });
    this.open.push(i);
    if (this.open.length < 2) return;
    this.moves.update((m) => m + 1);
    const [a, b] = this.open;
    if (this.cards()[a].icon === this.cards()[b].icon) {
      setTimeout(() => {
        this.update(a, { matched: true });
        this.update(b, { matched: true });
        this.platform.success();
        this.open = [];
        if (this.cards().every((x) => x.matched)) this.finish();
      }, 350);
    } else {
      setTimeout(() => {
        this.update(a, { flipped: false });
        this.update(b, { flipped: false });
        this.open = [];
      }, 800);
    }
  }

  private finish() {
    this.stop();
    this.won.set(true);
    this.record.set(this.scores.submit('memory', this.moves(), true));
    this.confetti.burst(0.5, 0.4);
    this.achievements.track('memory_win');
    this.achievements.track('game_played');
  }

  private update(i: number, patch: Partial<Card>) {
    this.cards.update((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  private stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
