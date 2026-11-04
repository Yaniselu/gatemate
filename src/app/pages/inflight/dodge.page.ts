import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { PlatformService } from '../../core/services/platform.service';
import { ConfettiService } from '../../shared/components/confetti.service';
import { ScoresService } from './scores.service';
import { AchievementsService } from '../../core/services/achievements.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { GameTutorialComponent, TutorialStep } from './game-tutorial.component';

interface Thing {
  x: number;
  y: number;
  r: number;
  vy: number;
  kind: 'cloud' | 'bird' | 'star';
  wobble: number;
}

@Component({
  selector: 'gm-dodge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, GameTutorialComponent, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/inflight" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>{{ 'Sky Dodge' | t }}</ion-title>
        <ion-buttons slot="end"><button class="gm-help" (click)="tut.open()" [attr.aria-label]="'How to play' | t"><ion-icon name="help-circle-outline" /></button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <gm-game-tutorial #tut game="dodge" title="Sky Dodge" icon="airplane-outline" [steps]="tutorial" />
    <ion-content [fullscreen]="true" [scrollY]="false">
      <div class="wrap" #wrap>
        <canvas #cv (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up()" (pointercancel)="up()"></canvas>
        <div class="hud glass strong"><span>⭐ {{ score() }}</span><span>{{ 'Best {n}' | t: { n: best() } }}</span></div>
        @if (state() !== 'playing') {
          <div class="overlay">
            <div class="panel glass strong">
              @if (state() === 'over') {
                <h2>{{ record() ? ('New record! 🏆' | t) : ('Turbulence!' | t) }}</h2>
                <p>{{ 'You scored' | t }} <b>{{ score() }}</b>.</p>
              } @else {
                <h2>{{ 'Sky Dodge' | t }}</h2>
                <p>{{ 'Drag left and right to steer. Dodge storms and birds, grab the stars.' | t }}</p>
              }
              <button class="gm-btn" (click)="start()"><ion-icon name="play" /> {{ state() === 'over' ? ('Fly again' | t) : ('Take off' | t) }}</button>
            </div>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .wrap { position: absolute; inset: 0; background: linear-gradient(180deg, #5ec8ff 0%, #a9e6f5 60%, #e6f8fa 100%); touch-action: none; }
    canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
    .hud { position: absolute; top: calc(64px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); display: flex; gap: 18px; padding: 8px 16px; border-radius: 999px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(11,27,43,.15); animation: gm-fade-in .3s; }
    .panel { padding: 24px; text-align: center; max-width: 320px; animation: gm-scale-in .45s var(--gm-ease-spring); }
    .panel h2 { margin: 0 0 6px; font-size: 24px; font-weight: 800; }
    .panel p { margin: 0 0 16px; color: var(--gm-ink-2); line-height: 1.45; }
  `,
})
export class DodgePage implements AfterViewInit {
  readonly tutorial: TutorialStep[] = [
    { icon: 'move-outline', text: 'Drag left and right to steer the plane.' },
    { icon: 'thunderstorm-outline', text: 'Dodge the storms and the birds.' },
    { icon: 'star-outline', text: 'Grab the stars for extra points.' },
    { icon: 'speedometer-outline', text: 'The longer you fly, the faster it gets.' },
  ];
  private platform = inject(PlatformService);
  private confetti = inject(ConfettiService);
  private scores = inject(ScoresService);
  private achievements = inject(AchievementsService);
  private cv = viewChild.required<ElementRef<HTMLCanvasElement>>('cv');
  private wrap = viewChild.required<ElementRef<HTMLElement>>('wrap');

  readonly state = signal<'ready' | 'playing' | 'over'>('ready');
  readonly score = signal(0);
  readonly best = signal(0);
  readonly record = signal(false);
  private ctx!: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private px = 0;
  private targetX = 0;
  private things: Thing[] = [];
  private raf = 0;
  private last = 0;
  private t = 0;
  private spawn = 0;
  private dragging = false;

  constructor() {
    void this.scores.load().then(() => this.best.set(this.scores.best()['dodge'] ?? 0));
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.raf));
  }

  ngAfterViewInit() {
    const c = this.cv().nativeElement;
    this.ctx = c.getContext('2d')!;
    const resize = () => {
      const r = this.wrap().nativeElement.getBoundingClientRect();
      const dpr = Math.min(2, devicePixelRatio || 1);
      this.w = r.width;
      this.h = r.height;
      c.width = r.width * dpr;
      c.height = r.height * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.px = this.targetX = this.w / 2;
      this.draw();
    };
    requestAnimationFrame(resize);
    addEventListener('resize', resize);
  }

  start() {
    this.platform.impact();
    this.things = [];
    this.score.set(0);
    this.record.set(false);
    this.t = 0;
    this.spawn = 0;
    this.px = this.targetX = this.w / 2;
    this.state.set('playing');
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame((n) => this.loop(n));
  }

  down(e: PointerEvent) {
    this.dragging = true;
    this.targetX = e.offsetX;
  }
  move(e: PointerEvent) {
    if (this.dragging || e.pointerType === 'mouse') this.targetX = e.offsetX;
  }
  up() {
    this.dragging = false;
  }

  private loop(now: number) {
    const dt = Math.min(0.033, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    const speed = 170 + this.t * 9;
    this.px += (this.targetX - this.px) * Math.min(1, dt * 12);
    this.spawn -= dt;
    if (this.spawn <= 0) {
      this.spawn = Math.max(0.28, 0.85 - this.t * 0.012);
      const r = Math.random();
      const kind: Thing['kind'] = r < 0.22 ? 'star' : r < 0.45 ? 'bird' : 'cloud';
      this.things.push({ x: 20 + Math.random() * (this.w - 40), y: -40, r: kind === 'cloud' ? 26 + Math.random() * 16 : kind === 'bird' ? 14 : 13, vy: speed * (0.8 + Math.random() * 0.5), kind, wobble: Math.random() * 6 });
    }
    const py = this.h - 120;
    for (const th of this.things) {
      th.y += th.vy * dt;
      if (th.kind === 'bird') th.x += Math.sin(this.t * 4 + th.wobble) * 1.6;
      const hit = Math.hypot(th.x - this.px, th.y - py) < th.r + 16;
      if (hit && th.kind === 'star') {
        th.y = this.h + 100;
        this.score.update((s) => s + 1);
        this.platform.selection();
      } else if (hit) {
        return this.gameOver();
      }
    }
    this.things = this.things.filter((th) => th.y < this.h + 60);
    if (Math.floor(this.t) !== Math.floor(this.t - dt) && Math.floor(this.t) % 5 === 0) this.score.update((s) => s + 1);
    this.draw();
    this.raf = requestAnimationFrame((n) => this.loop(n));
  }

  private gameOver() {
    this.platform.error();
    this.state.set('over');
    const isRecord = this.scores.submit('dodge', this.score());
    this.record.set(isRecord && this.score() > 0);
    this.best.set(this.scores.best()['dodge'] ?? 0);
    this.achievements.track('game_played');
    if (this.score() >= 25) this.achievements.track('dodge_25');
    if (this.record()) this.confetti.burst(0.5, 0.4);
    this.draw();
  }

  private draw() {
    const c = this.ctx;
    if (!c) return;
    c.clearRect(0, 0, this.w, this.h);
    c.fillStyle = 'rgba(255,255,255,.5)';
    for (let i = 0; i < 6; i++) {
      const y = ((i * 170 + this.t * 40) % (this.h + 120)) - 60;
      blob(c, (i * 97) % this.w, y, 30 + (i % 3) * 10);
    }
    for (const th of this.things) {
      if (th.kind === 'cloud') {
        c.fillStyle = '#5f7489';
        blob(c, th.x, th.y, th.r);
        c.fillStyle = '#ffd34d';
        c.beginPath();
        c.moveTo(th.x, th.y + th.r * 0.3);
        c.lineTo(th.x - 6, th.y + th.r * 0.9);
        c.lineTo(th.x + 2, th.y + th.r * 0.85);
        c.lineTo(th.x - 3, th.y + th.r * 1.4);
        c.lineTo(th.x + 9, th.y + th.r * 0.7);
        c.lineTo(th.x + 1, th.y + th.r * 0.75);
        c.closePath();
        c.fill();
      } else if (th.kind === 'bird') {
        c.strokeStyle = '#0b1b2b';
        c.lineWidth = 3;
        c.lineCap = 'round';
        const f = Math.sin(this.t * 14 + th.wobble) * 6;
        c.beginPath();
        c.moveTo(th.x - 14, th.y - f);
        c.quadraticCurveTo(th.x - 6, th.y - 8, th.x, th.y);
        c.quadraticCurveTo(th.x + 6, th.y - 8, th.x + 14, th.y - f);
        c.stroke();
      } else {
        star(c, th.x, th.y, th.r, this.t * 3);
      }
    }
    plane(c, this.px, this.h - 120, (this.targetX - this.px) / 40);
  }
}

function blob(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath();
  c.arc(x - r * 0.6, y, r * 0.6, 0, Math.PI * 2);
  c.arc(x, y - r * 0.3, r * 0.75, 0, Math.PI * 2);
  c.arc(x + r * 0.65, y, r * 0.55, 0, Math.PI * 2);
  c.fill();
}

function star(c: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.fillStyle = '#ffc531';
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
  c.restore();
}

function plane(c: CanvasRenderingContext2D, x: number, y: number, tilt: number) {
  c.save();
  c.translate(x, y);
  c.rotate(Math.max(-0.4, Math.min(0.4, tilt)));
  c.fillStyle = '#ffffff';
  c.strokeStyle = '#0a93a6';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(0, -26);
  c.quadraticCurveTo(6, -18, 5, 0);
  c.lineTo(26, 10);
  c.lineTo(26, 15);
  c.lineTo(5, 10);
  c.lineTo(4, 20);
  c.lineTo(11, 26);
  c.lineTo(-11, 26);
  c.lineTo(-4, 20);
  c.lineTo(-5, 10);
  c.lineTo(-26, 15);
  c.lineTo(-26, 10);
  c.lineTo(-5, 0);
  c.quadraticCurveTo(-6, -18, 0, -26);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = '#0fb5c3';
  c.fillRect(-2, -18, 4, 6);
  c.restore();
}
