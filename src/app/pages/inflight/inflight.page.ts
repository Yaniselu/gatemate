import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { TravelStore } from '../../core/services/travel.store';
import { ScoresService } from './scores.service';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { PressableDirective } from '../../shared/directives/pressable.directive';
import { SheenDirective } from '../../shared/directives/sheen.directive';
import { DurationPipe } from '../../shared/pipes/time.pipes';
import { TranslatePipe } from '../../core/i18n/i18n.service';

@Component({
  selector: 'gm-inflight',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, RouterLink, RevealDirective, PressableDirective, SheenDirective, DurationPipe],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/home" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>{{ 'In-flight' | t }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <div class="page">
        <div class="hero glass smoke anim-scale-in" gmSheen="2">
          <div class="stars" aria-hidden="true">@for (s of stars; track $index) { <i [style.left.%]="s.x" [style.top.%]="s.y" [style.animation-delay.s]="s.d"></i> }</div>
          <span class="gm-label light">{{ 'Airplane mode friendly' | t }}</span>
          <h1>{{ 'Make the flight fly by' | t }}</h1>
          @if (flight(); as f) {
            <p>{{ f.from.code }} → {{ f.to.code }} · {{ '{time} in the air' | t: { time: (f.durationMinutes | duration) } }}</p>
          } @else {
            <p>{{ 'Everything here works without Wi-Fi.' | t }}</p>
          }
          <div class="plane-track" aria-hidden="true"><span class="line"></span><ion-icon name="airplane" /></div>
        </div>

        <div class="gm-section-title"><h2>{{ 'Games' | t }}</h2></div>
        <div class="games">
          @for (g of games; track g.link; let i = $index) {
            <a class="game card" [class.wide]="g.wide" [routerLink]="g.link" [gmReveal]="i" gmPressable>
              <div class="art" [style.background]="g.bg"><ion-icon [name]="g.icon" /></div>
              <b>{{ g.title | t }}</b>
              <small>{{ g.desc | t }}</small>
              @if (g.bestLabel && scores.best()[g.key] !== undefined) {
                <span class="best"><ion-icon name="trophy-outline" /> {{ g.bestLabel | t }} {{ scores.best()[g.key] }}</span>
              }
            </a>
          }
        </div>

        <div class="gm-section-title"><h2>{{ 'Feel good' | t }}</h2></div>
        <div class="well card">
          @for (w of wellbeing; track w.link; let i = $index) {
            <a class="row" [routerLink]="w.link" [gmReveal]="i" gmPressable>
              <span class="gm-well accent"><ion-icon [name]="w.icon" /></span>
              <div class="txt"><b>{{ w.title | t }}</b><small>{{ w.desc | t }}</small></div>
              <ion-icon name="chevron-forward" class="chev" />
            </a>
          }
        </div>

        <div class="gm-section-title"><h2>{{ 'Beat jet lag' | t }}</h2></div>
        <div class="tips card">
          @for (t of jetlag; track t) { <p><ion-icon name="checkmark-circle" /> {{ t | t }}</p> }
        </div>
        <p class="disclaimer">{{ 'Wellbeing content is general guidance, not medical advice. If you feel unwell, tell the cabin crew.' | t }}</p>
      </div>
    </ion-content>
  `,
  styles: `
    .page { padding: 8px 16px 40px; }
    .hero { padding: 22px 18px; border-radius: 24px; overflow: hidden; }
    .hero h1 { color: #fff; font-size: 26px; font-weight: 800; margin: 6px 0 4px; }
    .hero p { margin: 0; color: rgba(255,255,255,.75); }
    .gm-label.light { color: rgba(255,255,255,.6); }
    .stars i { position: absolute; width: 2px; height: 2px; border-radius: 50%; background: var(--gm-card-bg); animation: twinkle 3s ease-in-out infinite; }
    @keyframes twinkle { 50% { opacity: .2; } }
    .plane-track { position: relative; height: 26px; margin-top: 18px; }
    .plane-track .line { position: absolute; left: 0; right: 0; top: 12px; border-top: 2px dashed rgba(255,255,255,.3); }
    .plane-track ion-icon { position: absolute; top: 2px; font-size: 22px; color: #9cf2f7; animation: cruise 8s ease-in-out infinite alternate; }
    @keyframes cruise { from { left: 0; } to { left: calc(100% - 22px); } }
    .games { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .game { display: flex; flex-direction: column; padding: 12px; text-decoration: none; color: var(--gm-ink); }
    .game.wide { grid-column: span 2; }
    .game.wide .art { height: 96px; }
    .art { height: 84px; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 34px; margin-bottom: 10px; }
    .art ion-icon { animation: gm-float 3s ease-in-out infinite; }
    .game b { font-size: 15px; }
    .game small { color: var(--gm-ink-3); font-size: 12.5px; margin-top: 2px; }
    .best { display: inline-flex; align-items: center; gap: 4px; margin-top: 8px; font-size: 12px; font-weight: 700; color: #a26700; }
    .well { padding: 2px 14px; }
    .row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--gm-line); text-decoration: none; color: var(--gm-ink); }
    .row:last-child { border-bottom: 0; }
    .txt { flex: 1; }
    .txt b { display: block; font-size: 15px; }
    .txt small { color: var(--gm-ink-3); font-size: 12.5px; }
    .chev { color: var(--gm-ink-3); }
    .tips { padding: 6px 14px; }
    .tips p { display: flex; gap: 8px; font-size: 14px; color: var(--gm-ink-2); line-height: 1.45; margin: 10px 0; }
    .tips ion-icon { flex: none; color: var(--gm-mint); font-size: 18px; margin-top: 1px; }
    .disclaimer { font-size: 12px; color: var(--gm-ink-3); text-align: center; margin-top: 16px; }
  `,
})
export class InflightPage implements OnInit {
  private store = inject(TravelStore);
  protected scores = inject(ScoresService);
  readonly flight = computed(() => this.store.nextFlight()?.flight);
  readonly stars = Array.from({ length: 26 }, (_, i) => ({ x: (i * 37) % 100, y: (i * 61) % 100, d: (i % 7) * 0.4 }));

  readonly games = [
    { key: 'dodge', link: '/inflight/dodge', title: 'Sky Dodge', desc: 'Steer through storms, grab stars', icon: 'thunderstorm', bg: '#2f6aa0', bestLabel: 'Best:', wide: true },
    { key: 'memory', link: '/inflight/memory', title: 'Boarding Memory', desc: 'Match the travel pairs', icon: 'albums-outline', bg: '#0a7f8c', bestLabel: 'Best moves:' },
    { key: '2048', link: '/inflight/2048', title: '2048 Altitude', desc: 'Swipe & merge to 2048', icon: 'trending-up', bg: '#c4673a', bestLabel: 'Best:' },
    { key: 'quiz', link: '/inflight/quiz', title: 'Code Quiz', desc: 'Guess the airport code', icon: 'earth', bg: '#1f3a56', bestLabel: 'Best:' },
    { key: 'flags', link: '/inflight/flags', title: 'Flag Quiz', desc: 'Name the country', icon: 'flag', bg: '#1f8a68', bestLabel: 'Best:' },
    { key: 'hangman', link: '/inflight/guess-city', title: 'Guess the City', desc: 'Keep the plane in the air', icon: 'search', bg: '#55599e', bestLabel: '' },
    { key: 'ttt', link: '/inflight/tictactoe', title: 'Planes & Clouds', desc: 'Tic-tac-toe vs the autopilot', icon: 'grid-outline', bg: '#0f2233', bestLabel: 'Wins:', wide: true },
  ];
  readonly wellbeing = [
    { link: '/inflight/breathe', title: 'Calm breathing', desc: 'Box breathing for take-off nerves', icon: 'leaf-outline' },
    { link: '/inflight/stretch', title: 'Seat stretches', desc: '6 moves · 3 minutes · keeps blood flowing', icon: 'body-outline' },
  ];
  readonly jetlag = [
    'Set your watch to destination time as soon as you board.',
    'Drink water every hour; go easy on alcohol and coffee.',
    'Get daylight in the morning after landing to reset your body clock.',
    'Short nap (20 min) if you must — then stay up until local bedtime.',
  ];

  ngOnInit() {
    void this.scores.load();
    void this.store.loadTrips();
  }
}
