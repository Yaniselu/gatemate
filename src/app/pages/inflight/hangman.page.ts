import { ChangeDetectionStrategy, Component, computed, HostListener, inject, signal } from '@angular/core';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { PlatformService } from '../../core/services/platform.service';
import { AchievementsService } from '../../core/services/achievements.service';
import { ConfettiService } from '../../shared/components/confetti.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { localCountryName } from '../../shared/pipes/country-name.pipe';
import { GameTutorialComponent, TutorialStep } from './game-tutorial.component';

const CITIES: [string, string][] = [
  ['BARCELONA', 'Spain'], ['LISBON', 'Portugal'], ['AMSTERDAM', 'Netherlands'], ['ISTANBUL', 'Türkiye'], ['REYKJAVIK', 'Iceland'], ['DUBROVNIK', 'Croatia'],
  ['EDINBURGH', 'United Kingdom'], ['COPENHAGEN', 'Denmark'], ['VIENNA', 'Austria'], ['PRAGUE', 'Czechia'], ['BUDAPEST', 'Hungary'], ['ATHENS', 'Greece'],
  ['FLORENCE', 'Italy'], ['NAPLES', 'Italy'], ['SEVILLE', 'Spain'], ['PORTO', 'Portugal'], ['MARRAKESH', 'Morocco'], ['CAIRO', 'Egypt'], ['DUBAI', 'UAE'],
  ['BANGKOK', 'Thailand'], ['SINGAPORE', 'Singapore'], ['TOKYO', 'Japan'], ['KYOTO', 'Japan'], ['SEOUL', 'South Korea'], ['SYDNEY', 'Australia'],
  ['TORONTO', 'Canada'], ['CHICAGO', 'United States'], ['HAVANA', 'Cuba'], ['BUENOS AIRES', 'Argentina'], ['RIO DE JANEIRO', 'Brazil'],
  ['CLUJ NAPOCA', 'Romania'], ['BRASOV', 'Romania'], ['SIBIU', 'Romania'], ['CONSTANTA', 'Romania'], ['TIMISOARA', 'Romania'], ['BUCHAREST', 'Romania'],
];
const LIVES = 6;

@Component({
  selector: 'gm-hangman',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, GameTutorialComponent, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/inflight" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>{{ 'Guess the City' | t }}</ion-title>
        <ion-buttons slot="end"><button class="gm-help" (click)="tut.open()" [attr.aria-label]="'How to play' | t"><ion-icon name="help-circle-outline" /></button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <gm-game-tutorial #tut game="guess-city" title="Guess the City" icon="business-outline" [steps]="tutorial" />
    <ion-content [fullscreen]="true">
      <div class="page">
        <div class="sky glass smoke">
          <div class="alt"><span class="gm-label light">{{ 'Altitude' | t }}</span><b>{{ (LIVES - misses()) * 6000 }} ft</b></div>
          <ion-icon name="airplane" class="plane" [style.--drop]="misses() / LIVES" [class.crash]="lost()" />
          <div class="ground"></div>
          <span class="hint">🌍 {{ country() }}</span>
        </div>
        <div class="word" [class.won]="won()" [class.lost]="lost()">
          @for (ch of letters(); track $index) {
            @if (ch === ' ') { <span class="gap"></span> } @else {
              <span class="slot" [class.shown]="shown(ch)">{{ shown(ch) ? ch : '' }}</span>
            }
          }
        </div>
        @if (won() || lost()) {
          <div class="end card">
            <h2>{{ won() ? ('Smooth landing! 🛬' | t) : ('Go-around! It was {city}' | t: { city: answer() }) }}</h2>
            <button class="gm-btn" (click)="next()"><ion-icon name="arrow-forward" /> {{ 'Next city' | t }}</button>
          </div>
        } @else {
          <div class="keys">
            @for (k of keys; track k) {
              <button [class.hit]="guessed().has(k) && answer().includes(k)" [class.miss]="guessed().has(k) && !answer().includes(k)" [disabled]="guessed().has(k)" (click)="guess(k)">{{ k }}</button>
            }
          </div>
        }
        <p class="streak">{{ 'Cities guessed this session:' | t }} <b>{{ wins() }}</b></p>
      </div>
    </ion-content>
  `,
  styles: `
    .page { padding: 8px 16px 40px; max-width: 520px; margin: 0 auto; }
    .sky { position: relative; height: 170px; border-radius: 24px; overflow: hidden; background: linear-gradient(180deg, #12304a, #2f6aa0) !important; }
    .alt { position: absolute; left: 14px; top: 12px; color: #fff; }
    .alt b { font-size: 18px; font-variant-numeric: tabular-nums; }
    .gm-label.light { color: rgba(255,255,255,.6); }
    .plane { position: absolute; left: 50%; top: calc(20px + var(--drop) * 95px); font-size: 44px; color: #fff; transform: translateX(-50%) rotate(calc(var(--drop) * 25deg)); transition: top .6s var(--gm-ease-spring), transform .6s var(--gm-ease-spring); filter: drop-shadow(0 6px 10px rgba(0,0,0,.3)); }
    .plane.crash { animation: gm-shake .5s 2; }
    .ground { position: absolute; left: 0; right: 0; bottom: 0; height: 22px; background: repeating-linear-gradient(90deg, #0b1b2b 0 30px, #1d3a52 30px 60px); }
    .hint { position: absolute; right: 12px; top: 12px; padding: 5px 10px; border-radius: 999px; background: rgba(255,255,255,.16); color: #fff; font-size: 13px; font-weight: 650; }
    .word { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin: 22px 0; }
    .slot { width: 30px; height: 40px; border-bottom: 3px solid var(--gm-ink-2); display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; }
    .slot.shown { animation: gm-pop .35s var(--gm-ease-spring); color: var(--gm-accent-strong); }
    .gap { width: 14px; }
    .word.won .slot { color: #138a57; border-color: var(--gm-mint); }
    .word.lost .slot { border-color: var(--gm-coral); }
    .keys { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
    .keys button { height: 44px; border-radius: 10px; background: var(--gm-card-bg); border: 1px solid var(--gm-card-border); font-weight: 750; font-size: 16px; color: var(--gm-ink); transition: transform .2s var(--gm-ease-spring); }
    .keys button:active { transform: scale(.9); }
    .keys button.hit { background: rgba(47,209,138,.15); color: #138a57; border-color: transparent; }
    .keys button.miss { background: var(--gm-surface); color: #b6c2cf; border-color: transparent; }
    .end { padding: 18px; text-align: center; animation: gm-scale-in .4s var(--gm-ease-spring); }
    .end h2 { font-size: 19px; margin: 0 0 12px; }
    .streak { text-align: center; color: var(--gm-ink-3); font-size: 13px; margin-top: 16px; }
  `,
})
export class HangmanPage {
  readonly tutorial: TutorialStep[] = [
    { icon: 'business-outline', text: 'Guess the hidden city, letter by letter.' },
    { icon: 'earth-outline', text: 'The country is your clue.' },
    { icon: 'trending-down-outline', text: 'Every wrong letter makes the plane lose altitude.' },
    { icon: 'airplane-outline', text: 'Find the city before the plane touches the ground.' },
  ];
  private platform = inject(PlatformService);
  private achievements = inject(AchievementsService);
  private confetti = inject(ConfettiService);
  protected readonly LIVES = LIVES;
  readonly keys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  readonly answer = signal('');
  readonly country = signal('');
  readonly guessed = signal(new Set<string>());
  readonly wins = signal(0);
  readonly letters = computed(() => this.answer().split(''));
  readonly misses = computed(() => [...this.guessed()].filter((k) => !this.answer().includes(k)).length);
  readonly won = computed(() => !!this.answer() && this.letters().every((c) => c === ' ' || this.guessed().has(c)));
  readonly lost = computed(() => this.misses() >= LIVES);

  constructor() {
    this.next();
  }

  next() {
    const [city, country] = CITIES[Math.floor(Math.random() * CITIES.length)];
    this.answer.set(city);
    this.country.set(localCountryName(country));
    this.guessed.set(new Set());
  }

  shown(ch: string) {
    return this.guessed().has(ch) || this.lost();
  }

  @HostListener('window:keydown', ['$event'])
  key(e: KeyboardEvent) {
    const k = e.key.toUpperCase();
    if (/^[A-Z]$/.test(k)) this.guess(k);
  }

  guess(k: string) {
    if (this.won() || this.lost() || this.guessed().has(k)) return;
    this.guessed.update((s) => new Set(s).add(k));
    if (this.answer().includes(k)) this.platform.selection();
    else this.platform.error();
    if (this.won()) {
      this.wins.update((n) => n + 1);
      this.platform.success();
      this.confetti.burst(0.5, 0.45, 60);
      this.achievements.track('hangman_win');
      this.achievements.track('game_played');
    } else if (this.lost()) this.achievements.track('game_played');
  }
}
