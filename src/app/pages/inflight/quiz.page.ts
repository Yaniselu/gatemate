import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { PlatformService } from '../../core/services/platform.service';
import { ConfettiService } from '../../shared/components/confetti.service';
import { ScoresService } from './scores.service';

const CODES: [string, string][] = [
  ['OTP', 'Bucharest'], ['CLJ', 'Cluj-Napoca'], ['IAS', 'Iași'], ['TSR', 'Timișoara'], ['LHR', 'London'], ['CDG', 'Paris'],
  ['FCO', 'Rome'], ['MAD', 'Madrid'], ['BCN', 'Barcelona'], ['LIS', 'Lisbon'], ['AMS', 'Amsterdam'], ['FRA', 'Frankfurt'],
  ['MUC', 'Munich'], ['VIE', 'Vienna'], ['ZRH', 'Zurich'], ['IST', 'Istanbul'], ['ATH', 'Athens'], ['DXB', 'Dubai'],
  ['JFK', 'New York'], ['LAX', 'Los Angeles'], ['HND', 'Tokyo'], ['SIN', 'Singapore'], ['SYD', 'Sydney'], ['BUD', 'Budapest'],
  ['WAW', 'Warsaw'], ['PRG', 'Prague'], ['CPH', 'Copenhagen'], ['DUB', 'Dublin'], ['MXP', 'Milan'], ['NCE', 'Nice'],
];
const ROUNDS = 10;

interface Q {
  code: string;
  answer: string;
  options: string[];
}

@Component({
  selector: 'gm-quiz',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/inflight" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>Code Quiz</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <div class="page">
        <div class="hud">
          <div class="card"><span class="gm-label">Round</span><b>{{ Math.min(round() + 1, rounds) }}/{{ rounds }}</b></div>
          <div class="card"><span class="gm-label">Score</span><b>{{ score() }}</b></div>
          <div class="card"><span class="gm-label">Streak</span><b>{{ streak() }}🔥</b></div>
        </div>
        @if (round() < rounds) {
          @if (q(); as qq) {
            <div class="board-q glass smoke">
              <span class="gm-label light">Which city is</span>
              @for (k of [qq.code]; track k + round()) { <div class="code">{{ k }}</div> }
              <div class="timer"><span [style.animation-duration.s]="8" [class.run]="!picked()"></span></div>
            </div>
            <div class="opts">
              @for (o of qq.options; track o + round(); let i = $index) {
                <button
                  class="opt card"
                  [style.--i]="i"
                  [class.right]="picked() && o === qq.answer"
                  [class.wrong]="picked() === o && o !== qq.answer"
                  [disabled]="!!picked()"
                  (click)="pick(o)"
                >{{ o }}</button>
              }
            </div>
          }
        } @else {
          <div class="end card">
            <ion-icon name="trophy" class="trophy" />
            <h2>{{ record() ? 'New record!' : score() >= 70 ? 'Captain material!' : 'Nice flight!' }}</h2>
            <p>You scored {{ score() }} points.</p>
            <button class="gm-btn" (click)="start()"><ion-icon name="refresh-outline" /> Play again</button>
          </div>
        }
      </div>
    </ion-content>
  `,
  styleUrl: './game-shell.scss',
  styles: `
    .board-q { padding: 22px; border-radius: 24px; text-align: center; }
    .gm-label.light { color: rgba(255,255,255,.6); }
    .code { font-size: 64px; font-weight: 850; letter-spacing: .08em; color: #fff; animation: gm-scale-in .45s var(--gm-ease-spring); }
    .timer { height: 4px; margin-top: 12px; border-radius: 4px; background: rgba(255,255,255,.15); overflow: hidden; }
    .timer span { display: block; height: 100%; background: #9cf2f7; transform-origin: left; }
    .timer span.run { animation: shrink linear forwards; }
    @keyframes shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }
    .opts { display: grid; gap: 10px; margin-top: 14px; }
    .opt { padding: 16px; font-size: 16px; font-weight: 650; text-align: left; color: var(--gm-ink); animation: gm-fade-up .35s var(--gm-ease-out) both; animation-delay: calc(var(--i) * 50ms); transition: background .25s, border-color .25s, transform .25s var(--gm-ease-spring); }
    .opt:active { transform: scale(.98); }
    .opt.right { background: rgba(47,209,138,.12); border-color: var(--gm-mint); color: #138a57; transform: scale(1.02); }
    .opt.wrong { background: rgba(255,90,95,.1); border-color: var(--gm-coral); color: #c2303a; animation: gm-shake .4s; }
  `,
})
export class QuizPage {
  private platform = inject(PlatformService);
  private confetti = inject(ConfettiService);
  protected scores = inject(ScoresService);
  protected readonly Math = Math;

  readonly rounds = ROUNDS;
  readonly round = signal(0);
  readonly score = signal(0);
  readonly streak = signal(0);
  readonly q = signal<Q | null>(null);
  readonly picked = signal<string | null>(null);
  readonly record = signal(false);
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private used = new Set<string>();

  constructor() {
    void this.scores.load();
    this.start();
  }

  start() {
    this.round.set(0);
    this.score.set(0);
    this.streak.set(0);
    this.used.clear();
    this.next();
  }

  private next() {
    const pool = CODES.filter(([c]) => !this.used.has(c));
    const [code, answer] = pool[Math.floor(Math.random() * pool.length)];
    this.used.add(code);
    const wrong = CODES.filter(([c]) => c !== code).sort(() => Math.random() - 0.5).slice(0, 3).map(([, city]) => city);
    this.q.set({ code, answer, options: [answer, ...wrong].sort(() => Math.random() - 0.5) });
    this.picked.set(null);
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(() => this.pick('__timeout__'), 8000);
  }

  pick(option: string) {
    if (this.picked()) return;
    if (this.timeout) clearTimeout(this.timeout);
    const q = this.q()!;
    this.picked.set(option);
    if (option === q.answer) {
      this.streak.update((s) => s + 1);
      this.score.update((s) => s + 5 + Math.min(this.streak(), 5));
      this.platform.success();
    } else {
      this.streak.set(0);
      this.platform.error();
    }
    setTimeout(() => {
      this.round.update((r) => r + 1);
      if (this.round() < ROUNDS) this.next();
      else {
        this.record.set(this.scores.submit('quiz', this.score()));
        if (this.score() >= 60) this.confetti.burst();
      }
    }, 1100);
  }
}
