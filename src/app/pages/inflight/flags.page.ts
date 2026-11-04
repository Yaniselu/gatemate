import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { PlatformService } from '../../core/services/platform.service';
import { AirportDbService } from '../../core/services/airport-db.service';
import { AchievementsService } from '../../core/services/achievements.service';
import { ConfettiService } from '../../shared/components/confetti.service';
import { ScoresService } from './scores.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { GameTutorialComponent, TutorialStep } from './game-tutorial.component';

const POOL = ['RO', 'ES', 'FR', 'IT', 'DE', 'GB', 'PT', 'GR', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI', 'IE', 'PL', 'CZ', 'HU', 'BG', 'HR',
  'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'JP', 'KR', 'CN', 'IN', 'TH', 'VN', 'ID', 'AU', 'NZ', 'ZA', 'EG', 'MA', 'TR', 'AE', 'IL', 'IS', 'MD', 'UA', 'CY', 'MT', 'SG', 'PE'];
const ROUNDS = 10;

const flag = (cc: string) => String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

@Component({
  selector: 'gm-flags',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, GameTutorialComponent, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/inflight" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>{{ 'Flag Quiz' | t }}</ion-title>
        <ion-buttons slot="end"><button class="gm-help" (click)="tut.open()" [attr.aria-label]="'How to play' | t"><ion-icon name="help-circle-outline" /></button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <gm-game-tutorial #tut game="flags" title="Flag Quiz" icon="flag-outline" [steps]="tutorial" />
    <ion-content [fullscreen]="true">
      <div class="page">
        <div class="hud">
          <div class="card"><span class="gm-label">{{ 'Round' | t }}</span><b>{{ Math.min(round() + 1, rounds) }}/{{ rounds }}</b></div>
          <div class="card"><span class="gm-label">{{ 'Correct' | t }}</span><b>{{ correct() }}</b></div>
          <div class="card"><span class="gm-label">{{ 'Best' | t }}</span><b>{{ best() }}</b></div>
        </div>
        @if (round() < rounds) {
          @if (q(); as qq) {
            @for (k of [qq.cc + round()]; track k) {
              <div class="flag-card glass strong"><span class="flag">{{ qq.flag }}</span></div>
            }
            <div class="opts">
              @for (o of qq.options; track o.cc + round(); let i = $index) {
                <button class="opt card" [style.--i]="i" [class.right]="picked() && o.cc === qq.cc" [class.wrong]="picked() === o.cc && o.cc !== qq.cc" [disabled]="!!picked()" (click)="pick(o.cc)">{{ o.name }}</button>
              }
            </div>
          }
        } @else {
          <div class="end card">
            <div class="big">{{ correct() >= 8 ? '🏆' : correct() >= 5 ? '🌍' : '🧭' }}</div>
            <h2>{{ correct() }}/{{ rounds }} flags</h2>
            <p>{{ correct() >= 8 ? ('True globetrotter!' | t) : ('Every trip makes you better at this.' | t) }}</p>
            <button class="gm-btn" (click)="start()"><ion-icon name="refresh-outline" /> {{ 'Play again' | t }}</button>
          </div>
        }
      </div>
    </ion-content>
  `,
  styleUrl: './game-shell.scss',
  styles: `
    .flag-card { display: flex; align-items: center; justify-content: center; height: 170px; border-radius: 24px; }
    .flag { font-size: 110px; line-height: 1; animation: wave-in .6s var(--gm-ease-spring); filter: drop-shadow(0 10px 16px rgba(0,0,0,.18)); }
    @keyframes wave-in { from { transform: rotate(-20deg) scale(.4); opacity: 0; } }
    .opts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
    .opt { padding: 16px 10px; font-size: 15px; font-weight: 650; color: var(--gm-ink); animation: gm-fade-up .35s var(--gm-ease-out) both; animation-delay: calc(var(--i) * 50ms); transition: all .25s var(--gm-ease-spring); }
    .opt.right { background: rgba(47,209,138,.12); border-color: var(--gm-mint); color: #138a57; transform: scale(1.03); }
    .opt.wrong { background: rgba(255,90,95,.1); border-color: var(--gm-coral); color: #c2303a; animation: gm-shake .4s; }
    .big { font-size: 60px; animation: gm-pop .6s var(--gm-ease-spring); }
  `,
})
export class FlagsPage implements OnInit {
  readonly tutorial: TutorialStep[] = [
    { icon: 'flag-outline', text: 'You see a country’s flag.' },
    { icon: 'list-outline', text: 'Pick the right country from four answers.' },
    { icon: 'trophy-outline', text: 'Ten flags per round. Try to beat your best score.' },
  ];
  private platform = inject(PlatformService);
  private db = inject(AirportDbService);
  private achievements = inject(AchievementsService);
  private confetti = inject(ConfettiService);
  private scores = inject(ScoresService);
  protected readonly Math = Math;
  readonly rounds = ROUNDS;
  readonly round = signal(0);
  readonly correct = signal(0);
  readonly best = signal(0);
  readonly picked = signal<string | null>(null);
  readonly q = signal<{ cc: string; flag: string; options: { cc: string; name: string }[] } | null>(null);
  private used = new Set<string>();

  async ngOnInit() {
    await Promise.all([this.db.load(), this.scores.load()]);
    this.best.set(this.scores.best()['flags'] ?? 0);
    this.start();
  }

  start() {
    this.round.set(0);
    this.correct.set(0);
    this.used.clear();
    this.next();
  }

  private next() {
    const pool = POOL.filter((c) => !this.used.has(c));
    const cc = pool[Math.floor(Math.random() * pool.length)];
    this.used.add(cc);
    const others = POOL.filter((c) => c !== cc).sort(() => Math.random() - 0.5).slice(0, 3);
    this.q.set({ cc, flag: flag(cc), options: [cc, ...others].sort(() => Math.random() - 0.5).map((c) => ({ cc: c, name: this.db.countryName(c) })) });
    this.picked.set(null);
  }

  pick(cc: string) {
    if (this.picked()) return;
    this.picked.set(cc);
    if (cc === this.q()!.cc) {
      this.correct.update((n) => n + 1);
      this.platform.success();
    } else this.platform.error();
    setTimeout(() => {
      this.round.update((r) => r + 1);
      if (this.round() < ROUNDS) return this.next();
      this.achievements.track('game_played');
      if (this.correct() >= 8) {
        this.achievements.track('flags_win');
        this.confetti.burst();
      }
      if (this.scores.submit('flags', this.correct())) this.best.set(this.correct());
    }, 1000);
  }
}
