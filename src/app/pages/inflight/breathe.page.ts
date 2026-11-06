import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { PlatformService } from '../../core/services/platform.service';
import { AchievementsService } from '../../core/services/achievements.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { GameTutorialComponent, TutorialStep } from './game-tutorial.component';

const PHASES = [
  { label: 'Breathe in', secs: 4, scale: 1 },
  { label: 'Hold', secs: 4, scale: 1 },
  { label: 'Breathe out', secs: 4, scale: 0.55 },
  { label: 'Hold', secs: 4, scale: 0.55 },
];

@Component({
  selector: 'gm-breathe',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, GameTutorialComponent, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/inflight" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>{{ 'Calm breathing' | t }}</ion-title>
        <ion-buttons slot="end"><button class="gm-help" (click)="tut.open()" [attr.aria-label]="'How to play' | t"><ion-icon name="help-circle-outline" /></button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <gm-game-tutorial #tut game="breathe" title="Calm breathing" icon="leaf-outline" color="#1f9d8b" [steps]="tutorial" />
    <ion-content [fullscreen]="true" class="calm">
      <div class="wrap">
        <div class="orb-wrap">
          <div class="halo" [style.transform]="'scale(' + scale() * 1.25 + ')'" [style.transition-duration.s]="dur()"></div>
          <div class="orb glass" [style.transform]="'scale(' + scale() + ')'" [style.transition-duration.s]="dur()">
            <span class="phase">{{ running() ? (phase() | t) : ('Ready' | t) }}</span>
            @if (running()) { <span class="count">{{ left() }}</span> }
          </div>
        </div>
        <p class="hint">{{ 'Box breathing: 4 seconds in, hold, out, hold. Helps with take-off and turbulence nerves.' | t }}</p>
        <div class="stats"><span class="gm-label">{{ 'Cycles' | t }}</span><b>{{ cycles() }}</b></div>
        <button class="gm-btn" (click)="toggle()"><ion-icon [name]="running() ? 'pause-outline' : 'play-outline'" /> {{ running() ? ('Pause' | t) : ('Start' | t) }}</button>
      </div>
    </ion-content>
  `,
  styles: `
    .calm { --background: radial-gradient(120% 80% at 50% 20%, rgba(15, 181, 195, .16) 0%, transparent 60%); }
    .wrap { display: flex; flex-direction: column; align-items: center; padding: 24px 24px 40px; }
    .orb-wrap { position: relative; width: 280px; height: 280px; display: flex; align-items: center; justify-content: center; margin: 10px 0 18px; }
    .halo { position: absolute; inset: 20px; border-radius: 50%; background: radial-gradient(circle, rgba(15,181,195,.28), transparent 70%); transition-property: transform; transition-timing-function: ease-in-out; transform: scale(.7); }
    .orb { width: 240px; height: 240px; border-radius: 50% !important; display: flex; flex-direction: column; align-items: center; justify-content: center; background: radial-gradient(circle at 35% 25%, rgba(255,255,255,.95), rgba(34,199,211,.35) 70%) !important; transform: scale(.55); transition-property: transform; transition-timing-function: ease-in-out; }
    .phase { font-size: 20px; font-weight: 750; color: #08707f; }
    .count { font-size: 44px; font-weight: 850; color: var(--gm-navy); font-variant-numeric: tabular-nums; }
    .hint { text-align: center; color: var(--gm-ink-3); max-width: 300px; line-height: 1.5; }
    .stats { text-align: center; margin: 6px 0 18px; }
    .stats b { font-size: 26px; }
  `,
})
export class BreathePage {
  readonly tutorial: TutorialStep[] = [
    { icon: 'radio-button-on-outline', text: 'Follow the circle and breathe in as it grows.' },
    { icon: 'pause-outline', text: 'Hold, breathe out as it shrinks, then hold again.' },
    { icon: 'repeat-outline', text: 'A few rounds help with take-off and turbulence nerves.' },
  ];
  private platform = inject(PlatformService);
  private achievements = inject(AchievementsService);
  private counted = false;
  readonly running = signal(false);
  readonly phase = signal(PHASES[0].label);
  readonly scale = signal(0.55);
  readonly dur = signal(4);
  readonly left = signal(4);
  readonly cycles = signal(0);
  private i = 0;
  private tick: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  toggle() {
    if (this.running()) this.stop();
    else {
      this.running.set(true);
      this.i = 0;
      this.enter();
      this.tick = setInterval(() => {
        this.left.update((l) => l - 1);
        if (this.left() <= 0) {
          this.i = (this.i + 1) % PHASES.length;
          if (this.i === 0) {
            this.cycles.update((c) => c + 1);
            if (this.cycles() === 3 && !this.counted) {
              this.counted = true;
              this.achievements.track('breathe_session');
            }
          }
          this.enter();
        }
      }, 1000);
    }
  }

  private enter() {
    const p = PHASES[this.i];
    this.phase.set(p.label);
    this.left.set(p.secs);
    this.dur.set(p.secs);
    this.scale.set(p.scale);
    this.platform.impact();
  }

  private stop() {
    if (this.tick) clearInterval(this.tick);
    this.tick = null;
    this.running.set(false);
    this.scale.set(0.55);
  }
}
