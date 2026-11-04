import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { PlatformService } from '../../core/services/platform.service';
import { ConfettiService } from '../../shared/components/confetti.service';
import { AchievementsService } from '../../core/services/achievements.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { GameTutorialComponent, TutorialStep } from './game-tutorial.component';

const MOVES = [
  { title: 'Ankle circles', body: 'Lift your feet slightly and draw circles with your toes — 10 each direction.', icon: 'sync-outline' },
  { title: 'Foot pumps', body: 'Heels down, lift toes high. Then toes down, lift heels. Repeat in rhythm.', icon: 'footsteps-outline' },
  { title: 'Knee lifts', body: 'Lift one knee towards your chest, hold 2 s, switch legs.', icon: 'arrow-up' },
  { title: 'Shoulder rolls', body: 'Roll your shoulders up, back and down slowly. Reverse after 5.', icon: 'refresh-outline' },
  { title: 'Neck release', body: 'Tilt your ear towards your shoulder, hold 10 s, switch sides. No forcing.', icon: 'swap-horizontal' },
  { title: 'Forward fold', body: 'Feet flat, slowly bend forward and let your arms hang towards your ankles.', icon: 'body-outline' },
];
const SECS = 30;

@Component({
  selector: 'gm-stretch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, GameTutorialComponent, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/inflight" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>{{ 'Seat stretches' | t }}</ion-title>
        <ion-buttons slot="end"><button class="gm-help" (click)="tut.open()" [attr.aria-label]="'How to play' | t"><ion-icon name="help-circle-outline" /></button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <gm-game-tutorial #tut game="stretch" title="Seat stretches" icon="body-outline" [steps]="tutorial" />
    <ion-content [fullscreen]="true">
      <div class="page">
        <div class="dots">@for (m of moves; track m.title; let i = $index) { <span [class.done]="i < index()" [class.on]="i === index()"></span> }</div>
        @for (m of [move()]; track m.title) {
          <div class="move card">
            <div class="ring">
              <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" class="bg" /><circle cx="60" cy="60" r="52" class="fg" [style.stroke-dashoffset]="327 - 327 * (1 - left() / secs)" /></svg>
              <div class="center"><ion-icon [name]="m.icon" /><b>{{ left() }}s</b></div>
            </div>
            <span class="gm-label">{{ 'Move {n} of {total}' | t: { n: index() + 1, total: moves.length } }}</span>
            <h2>{{ m.title | t }}</h2>
            <p>{{ m.body | t }}</p>
          </div>
        }
        @if (finished()) {
          <p class="done-msg">{{ 'All done — your legs say thank you 🙌' | t }}</p>
        }
        <div class="controls">
          <button class="gm-btn ghost small" (click)="go(-1)" [disabled]="index() === 0"><ion-icon name="chevron-back" /></button>
          <button class="gm-btn" (click)="toggle()"><ion-icon [name]="running() ? 'pause-outline' : 'play-outline'" /> {{ running() ? ('Pause' | t) : finished() ? ('Restart' | t) : ('Start' | t) }}</button>
          <button class="gm-btn ghost small" (click)="go(1)" [disabled]="index() === moves.length - 1"><ion-icon name="chevron-forward" /></button>
        </div>
        <p class="note">{{ 'Stop if anything hurts. Keep your seatbelt fastened while seated.' | t }}</p>
      </div>
    </ion-content>
  `,
  styles: `
    .page { padding: 8px 16px 40px; max-width: 520px; margin: 0 auto; }
    .dots { display: flex; gap: 6px; justify-content: center; margin: 4px 0 14px; }
    .dots span { width: 22px; height: 5px; border-radius: 3px; background: #e3eaf0; transition: all .4s var(--gm-ease-spring); }
    .dots span.done { background: var(--gm-accent); }
    .dots span.on { width: 36px; background: var(--gm-navy); }
    .move { padding: 24px 20px; text-align: center; animation: gm-fade-up .4s var(--gm-ease-out); }
    .ring { position: relative; width: 150px; height: 150px; margin: 0 auto 16px; }
    .ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .ring circle { fill: none; stroke-width: 9; }
    .ring .bg { stroke: #edf2f6; }
    .ring .fg { stroke: var(--gm-accent); stroke-linecap: round; stroke-dasharray: 327; transition: stroke-dashoffset 1s linear; }
    .center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .center ion-icon { font-size: 34px; color: var(--gm-accent-strong); animation: gm-float 2s ease-in-out infinite; }
    .center b { font-size: 22px; font-variant-numeric: tabular-nums; }
    h2 { margin: 6px 0; font-size: 22px; font-weight: 800; }
    p { color: var(--gm-ink-2); line-height: 1.5; margin: 0; }
    .controls { display: grid; grid-template-columns: 56px 1fr 56px; gap: 10px; margin-top: 16px; }
    .controls .small { width: 56px; height: 56px; padding: 0; }
    .done-msg { text-align: center; font-weight: 700; margin-top: 14px; color: #138a57; }
    .note { text-align: center; font-size: 12px; color: var(--gm-ink-3); margin-top: 14px; }
  `,
})
export class StretchPage {
  readonly tutorial: TutorialStep[] = [
    { icon: 'body-outline', text: 'Follow each move while you stay seated.' },
    { icon: 'timer-outline', text: 'Each move has a timer and the next one starts by itself.' },
    { icon: 'warning-outline', text: 'Stop if anything hurts and keep your seatbelt fastened.' },
  ];
  private platform = inject(PlatformService);
  private confetti = inject(ConfettiService);
  private achievements = inject(AchievementsService);
  readonly moves = MOVES;
  readonly secs = SECS;
  readonly index = signal(0);
  readonly left = signal(SECS);
  readonly running = signal(false);
  readonly finished = signal(false);
  readonly move = computed(() => MOVES[this.index()]);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pause());
  }

  toggle() {
    if (this.running()) return this.pause();
    if (this.finished()) {
      this.finished.set(false);
      this.index.set(0);
      this.left.set(SECS);
    }
    this.running.set(true);
    this.timer = setInterval(() => {
      this.left.update((l) => l - 1);
      if (this.left() > 0) return;
      this.platform.impact();
      if (this.index() < MOVES.length - 1) {
        this.index.update((i) => i + 1);
        this.left.set(SECS);
      } else {
        this.pause();
        this.finished.set(true);
        this.platform.success();
        this.confetti.burst();
        this.achievements.track('stretch_done');
      }
    }, 1000);
  }

  go(d: number) {
    this.platform.tap();
    this.index.update((i) => Math.max(0, Math.min(MOVES.length - 1, i + d)));
    this.left.set(SECS);
  }

  private pause() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running.set(false);
  }
}
