import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { PlatformService } from '../../core/services/platform.service';
import { ConfettiService } from '../../shared/components/confetti.service';
import { ScoresService } from './scores.service';
import { AchievementsService } from '../../core/services/achievements.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';

type Cell = 'P' | 'C' | null;
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

function winner(b: Cell[]): { who: Cell; line: number[] } | null {
  for (const l of LINES) if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return { who: b[l[0]], line: l };
  return null;
}

function minimax(b: Cell[], turn: 'C' | 'P'): number {
  const w = winner(b);
  if (w) return w.who === 'C' ? 1 : -1;
  if (b.every(Boolean)) return 0;
  const scores = b.map((c, i) => {
    if (c) return null;
    const nb = [...b];
    nb[i] = turn;
    return minimax(nb, turn === 'C' ? 'P' : 'C');
  }).filter((s): s is number => s !== null);
  return turn === 'C' ? Math.max(...scores) : Math.min(...scores);
}

@Component({
  selector: 'gm-tictactoe',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/inflight" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>{{ 'Planes & Clouds' | t }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <div class="page">
        <div class="hud">
          <div class="card"><span class="gm-label">{{ 'You ✈️' | t }}</span><b>{{ wins() }}</b></div>
          <div class="card"><span class="gm-label">{{ 'Draws' | t }}</span><b>{{ draws() }}</b></div>
          <div class="card"><span class="gm-label">{{ 'Autopilot ☁️' | t }}</span><b>{{ losses() }}</b></div>
        </div>
        <div class="seg">
          @for (l of levels; track l.id) { <button [class.on]="level() === l.id" (click)="level.set(l.id); reset()">{{ l.label | t }}</button> }
        </div>
        <div class="board glass" [class.over]="!!result()">
          @for (c of board(); track $index; let i = $index) {
            <button class="cell" (click)="play(i)" [class.win]="winLine().includes(i)" [attr.aria-label]="c === 'P' ? ('Plane' | t) : c === 'C' ? ('Cloud' | t) : ('Empty' | t)">
              @if (c === 'P') { <ion-icon name="airplane" class="p" /> }
              @if (c === 'C') { <ion-icon name="cloud" class="c" /> }
            </button>
          }
        </div>
        <p class="status">{{ status() | t }}</p>
        <button class="gm-btn" (click)="reset()"><ion-icon name="refresh-outline" /> {{ 'New game' | t }}</button>
      </div>
    </ion-content>
  `,
  styleUrl: './game-shell.scss',
  styles: `
    .seg { display: flex; gap: 6px; margin-bottom: 14px; }
    .seg button { flex: 1; padding: 9px; border-radius: 12px; background: var(--gm-surface); font-weight: 650; color: var(--gm-ink-3); transition: all .3s var(--gm-ease-spring); }
    .seg button.on { background: var(--gm-navy); color: #fff; }
    .board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 10px; border-radius: 26px; }
    .cell { aspect-ratio: 1; border-radius: 18px; background: rgba(255,255,255,.65); border: 1px solid rgba(11,27,43,.05); font-size: 44px; display: flex; align-items: center; justify-content: center; transition: background .3s, transform .3s var(--gm-ease-spring); }
    .cell:active { transform: scale(.94); }
    .cell ion-icon { animation: gm-pop .45s var(--gm-ease-spring); }
    .p { color: var(--gm-accent-strong); }
    .c { color: #8b9fb4; }
    .cell.win { background: var(--gm-accent-soft); animation: gm-bounce-icon .6s var(--gm-ease-spring); }
    .status { text-align: center; font-weight: 700; font-size: 16px; margin: 16px 0; min-height: 22px; }
  `,
})
export class TicTacToePage {
  private platform = inject(PlatformService);
  private confetti = inject(ConfettiService);
  private scores = inject(ScoresService);
  private achievements = inject(AchievementsService);

  readonly levels = [{ id: 'easy', label: 'Easy' }, { id: 'pilot', label: 'Pilot' }, { id: 'ace', label: 'Ace' }] as const;
  readonly level = signal<'easy' | 'pilot' | 'ace'>('pilot');
  readonly board = signal<Cell[]>(Array(9).fill(null));
  readonly result = signal<'win' | 'loss' | 'draw' | null>(null);
  readonly wins = signal(0);
  readonly losses = signal(0);
  readonly draws = signal(0);
  readonly winLine = computed(() => winner(this.board())?.line ?? []);
  readonly status = computed(() =>
    this.result() === 'win' ? 'You win! Smooth landing ✈️' : this.result() === 'loss' ? 'The autopilot wins this time ☁️' : this.result() === 'draw' ? 'Draw — holding pattern.' : 'Your move',
  );
  private busy = false;

  constructor() {
    void this.scores.load().then(() => this.wins.set(this.scores.best()['ttt'] ?? 0));
  }

  play(i: number) {
    if (this.busy || this.result() || this.board()[i]) return;
    this.platform.tap();
    this.set(i, 'P');
    if (this.check()) return;
    this.busy = true;
    setTimeout(() => {
      this.set(this.aiMove(), 'C');
      this.busy = false;
      this.check();
    }, 420);
  }

  reset() {
    this.board.set(Array(9).fill(null));
    this.result.set(null);
  }

  private aiMove(): number {
    const b = this.board();
    const free = b.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
    const mistake = { easy: 0.6, pilot: 0.2, ace: 0 }[this.level()];
    if (Math.random() < mistake) return free[Math.floor(Math.random() * free.length)];
    let best = -Infinity;
    let move = free[0];
    for (const i of free) {
      const nb = [...b];
      nb[i] = 'C';
      const s = minimax(nb, 'P');
      if (s > best) [best, move] = [s, i];
    }
    return move;
  }

  private set(i: number, v: Cell) {
    this.board.update((b) => b.map((c, j) => (j === i ? v : c)));
  }

  private check(): boolean {
    const w = winner(this.board());
    if (w?.who === 'P') {
      this.result.set('win');
      this.wins.update((n) => n + 1);
      this.scores.submit('ttt', this.wins());
      this.platform.success();
      this.confetti.burst(0.5, 0.45, 70);
      this.achievements.track('ttt_win');
    } else if (w?.who === 'C') {
      this.result.set('loss');
      this.losses.update((n) => n + 1);
      this.platform.error();
    } else if (this.board().every(Boolean)) {
      this.result.set('draw');
      this.draws.update((n) => n + 1);
    }
    if (this.result()) this.achievements.track('game_played');
    return !!this.result();
  }
}
