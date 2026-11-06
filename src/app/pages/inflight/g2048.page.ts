import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { PlatformService } from '../../core/services/platform.service';
import { ConfettiService } from '../../shared/components/confetti.service';
import { ScoresService } from './scores.service';
import { AchievementsService } from '../../core/services/achievements.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { GameTutorialComponent, TutorialStep } from './game-tutorial.component';

interface Tile {
  id: number;
  v: number;
  r: number;
  c: number;
  merged?: boolean;
  fresh?: boolean;
}

@Component({
  selector: 'gm-2048',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, GameTutorialComponent, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/inflight" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>{{ '2048 Altitude' | t }}</ion-title>
        <ion-buttons slot="end"><button class="gm-help" (click)="tut.open()" [attr.aria-label]="'How to play' | t"><ion-icon name="help-circle-outline" /></button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <gm-game-tutorial #tut game="2048" title="2048 Altitude" icon="apps-outline" color="#c4673a" scoreKey="2048" scoreLabel="Best:" [steps]="tutorial" />
    <ion-content [fullscreen]="true" [scrollY]="false">
      <div class="page">
        <div class="hud">
          <div class="card"><span class="gm-label">{{ 'Score' | t }}</span><b>{{ score() }}</b></div>
          <div class="card"><span class="gm-label">{{ 'Best' | t }}</span><b>{{ best() }}</b></div>
          <button class="card again" (click)="reset()" [aria-label]="'New game' | t"><ion-icon name="refresh-outline" /></button>
        </div>
        <div class="board glass" (pointerdown)="ps($event)" (pointerup)="pe($event)">
          @for (i of cells; track i) { <span class="cell"></span> }
          @for (t of tiles(); track t.id) {
            <span class="tile" [attr.data-v]="t.v" [class.merged]="t.merged" [class.fresh]="t.fresh" [style.--r]="t.r" [style.--c]="t.c">{{ t.v }}</span>
          }
          @if (over()) {
            <div class="end"><b>{{ won() ? ('You reached 2048! ✈️' | t) : ('No more moves' | t) }}</b><button class="gm-btn small" (click)="reset()">{{ 'Try again' | t }}</button></div>
          }
        </div>
        <p class="hint">{{ 'Swipe in any direction. Merge tiles to climb from 2 to 2048 ft… ×1000.' | t }}</p>
      </div>
    </ion-content>
  `,
  styles: `
    .page { padding: 8px 16px 40px; max-width: 480px; margin: 0 auto; }
    .hud { display: grid; grid-template-columns: 1fr 1fr 56px; gap: 8px; margin-bottom: 14px; }
    .hud .card { padding: 10px 12px; text-align: center; }
    .hud b { display: block; font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .again { display: flex; align-items: center; justify-content: center; font-size: 22px; color: var(--gm-ink); }
    .board { --gap: 8px; --size: calc((100% - 5 * var(--gap)) / 4); position: relative; aspect-ratio: 1; padding: var(--gap); border-radius: 22px; display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--gap); touch-action: none; }
    .cell { border-radius: 12px; background: var(--gm-surface); }
    .tile { position: absolute; width: var(--size); height: var(--size); left: calc(var(--gap) + var(--c) * (var(--size) + var(--gap))); top: calc(var(--gap) + var(--r) * (var(--size) + var(--gap))); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 850; font-size: 26px; color: var(--gm-ink); background: var(--gm-card-bg); box-shadow: 0 4px 10px rgba(11,40,60,.12); transition: left .14s ease, top .14s ease; z-index: 3; }
    .tile.fresh { animation: gm-scale-in .22s var(--gm-ease-spring); }
    .tile.merged { animation: gm-pop .25s var(--gm-ease-spring); }
    .tile[data-v="2"] { background: #ffffff; color: #0b3a44; }
    .tile[data-v="4"] { background: #e6f8fa; color: #0b3a44; }
    .tile[data-v="8"] { background: #bdeef3; color: #0b3a44; }
    .tile[data-v="16"] { background: #7fdbe4; color: #08404a; }
    .tile[data-v="32"] { background: #3fc9d6; color: #fff; }
    .tile[data-v="64"] { background: #0fb5c3; color: #fff; }
    .tile[data-v="128"] { background: #0a93a6; color: #fff; font-size: 22px; }
    .tile[data-v="256"] { background: #12304a; color: #fff; font-size: 22px; }
    .tile[data-v="512"] { background: #8b7cf6; color: #fff; font-size: 22px; }
    .tile[data-v="1024"] { background: #ff8a5b; color: #fff; font-size: 19px; }
    .tile[data-v="2048"] { background: linear-gradient(135deg, #ffd27a, #ff8a5b); color: #fff; font-size: 19px; box-shadow: 0 0 24px rgba(255,180,90,.7); }
    .end { position: absolute; inset: 0; z-index: 5; border-radius: inherit; display: flex; flex-direction: column; gap: 12px; align-items: center; justify-content: center; background: color-mix(in srgb, var(--gm-card-bg) 82%, transparent); color: var(--gm-ink); backdrop-filter: blur(6px); animation: gm-fade-in .3s; }
    .end b { font-size: 20px; }
    .hint { text-align: center; color: var(--gm-ink-3); font-size: 13px; margin-top: 14px; }
  `,
})
export class G2048Page {
  readonly tutorial: TutorialStep[] = [
    { icon: 'swap-horizontal-outline', text: 'Swipe in any direction to move all the tiles.' },
    { icon: 'git-merge-outline', text: 'Two tiles with the same number merge into one.' },
    { icon: 'trending-up-outline', text: 'Keep merging to climb from 2 to 2048.' },
  ];
  private platform = inject(PlatformService);
  private confetti = inject(ConfettiService);
  private scores = inject(ScoresService);
  private achievements = inject(AchievementsService);
  readonly cells = Array.from({ length: 16 }, (_, i) => i);
  readonly tiles = signal<Tile[]>([]);
  readonly score = signal(0);
  readonly best = signal(0);
  readonly over = signal(false);
  readonly won = signal(false);
  private id = 0;
  private ghosts = new Set<number>();
  private game = 0;
  private sx = 0;
  private sy = 0;

  constructor() {
    void this.scores.load().then(() => this.best.set(this.scores.best()['2048'] ?? 0));
    this.reset();
  }

  reset() {
    this.game++;
    this.ghosts = new Set();
    this.tiles.set([]);
    this.score.set(0);
    this.over.set(false);
    this.won.set(false);
    this.add();
    this.add();
  }

  @HostListener('window:keydown', ['$event'])
  key(e: KeyboardEvent) {
    const map: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (map[e.key]) {
      e.preventDefault();
      this.move(...map[e.key]);
    }
  }

  ps(e: PointerEvent) {
    this.sx = e.clientX;
    this.sy = e.clientY;
  }

  pe(e: PointerEvent) {
    const dx = e.clientX - this.sx, dy = e.clientY - this.sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) this.move(0, dx > 0 ? 1 : -1);
    else this.move(dy > 0 ? 1 : -1, 0);
  }

  private add() {
    const taken = new Set(this.tiles().map((t) => t.r * 4 + t.c));
    const free = this.cells.filter((i) => !taken.has(i));
    if (!free.length) return;
    const i = free[Math.floor(Math.random() * free.length)];
    this.tiles.update((ts) => [...ts.map((t) => ({ ...t, fresh: false, merged: false })), { id: ++this.id, v: Math.random() < 0.9 ? 2 : 4, r: Math.floor(i / 4), c: i % 4, fresh: true }]);
  }

  private move(dr: number, dc: number) {
    if (this.over()) return;
    const grid: (Tile | null)[][] = Array.from({ length: 4 }, () => Array(4).fill(null));
    const tiles = this.tiles().filter((t) => !this.ghosts.has(t.id)).map((t) => ({ ...t, merged: false, fresh: false }));
    tiles.forEach((t) => (grid[t.r][t.c] = t));
    const order = [0, 1, 2, 3];
    const rows = dr === 1 ? [...order].reverse() : order;
    const cols = dc === 1 ? [...order].reverse() : order;
    let moved = false;
    let gained = 0;
    const removed = new Set<number>();
    for (const r of rows) {
      for (const c of cols) {
        const t = grid[r][c];
        if (!t) continue;
        let nr = r, nc = c;
        while (true) {
          const tr = nr + dr, tc = nc + dc;
          if (tr < 0 || tr > 3 || tc < 0 || tc > 3) break;
          const other = grid[tr][tc];
          if (!other) {
            grid[nr][nc] = null;
            nr = tr;
            nc = tc;
            grid[nr][nc] = t;
            continue;
          }
          if (other.v === t.v && !other.merged && !t.merged) {
            grid[nr][nc] = null;
            other.v *= 2;
            other.merged = true;
            gained += other.v;
            removed.add(t.id);
            t.r = tr;
            t.c = tc;
            moved = true;
          }
          break;
        }
        if (!removed.has(t.id) && (t.r !== nr || t.c !== nc)) {
          t.r = nr;
          t.c = nc;
          moved = true;
        }
      }
    }
    if (!moved) return;
    this.platform.selection();
    this.tiles.set(tiles);
    this.ghosts = removed;
    const game = this.game;
    setTimeout(() => {
      if (game !== this.game) return;
      this.tiles.update((ts) => ts.filter((t) => !removed.has(t.id)));
      if (this.ghosts === removed) this.ghosts = new Set();
      this.add();
      this.score.update((s) => s + gained);
      if (gained) this.platform.tap();
      if (this.tiles().some((t) => t.v >= 2048) && !this.won()) {
        this.won.set(true);
        this.over.set(true);
        if (this.scores.submit('2048', this.score())) this.best.set(this.score());
        this.confetti.burst();
        this.achievements.track('g2048_win');
      }
      if (!this.over() && !this.canMove()) this.finish();
    }, 140);
  }

  private canMove(): boolean {
    const ts = this.tiles();
    if (ts.length < 16) return true;
    const at = (r: number, c: number) => ts.find((t) => t.r === r && t.c === c)?.v;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (at(r, c) === at(r, c + 1) || at(r, c) === at(r + 1, c)) return true;
    return false;
  }

  private finish() {
    this.over.set(true);
    this.platform.error();
    if (this.scores.submit('2048', this.score())) this.best.set(this.score());
    this.achievements.track('game_played');
  }
}
