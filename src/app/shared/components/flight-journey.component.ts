import { AfterViewInit, ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, NgZone, OnDestroy, signal, viewChild } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { DecimalPipe } from '@angular/common';
import { Flight } from '../../core/models';
import { AirportDbService } from '../../core/services/airport-db.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import type { FlightJourneyScene, JourneyFrame, JourneyPhase } from './flight-journey.scene';

const PHASES: Record<JourneyPhase, { label: string; icon: string }> = {
  taxi: { label: 'Taxiing to the runway', icon: 'navigate-outline' },
  takeoff: { label: 'Take-off', icon: 'airplane-outline' },
  cruise: { label: 'Cruising', icon: 'globe-outline' },
  landing: { label: 'Landing', icon: 'arrow-down-circle-outline' },
  arrived: { label: 'Arrived', icon: 'checkmark-circle' },
};

@Component({
  selector: 'gm-flight-journey',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, TranslatePipe, DecimalPipe],
  template: `
    @if (!failed()) {
      <div class="stage" [class.ready]="ready()">
        <canvas #canvas aria-hidden="true"></canvas>
        <div class="fade" [style.opacity]="frame().fade"></div>

        @if (!ready()) { <div class="loading"><span class="spin"></span></div> }

        <div class="top">
          <span class="phase" [attr.data-phase]="frame().phase">
            <ion-icon [name]="phaseMeta().icon" />{{ phaseMeta().label | t }}
          </span>
          <button class="replay" (click)="replay()" [attr.aria-label]="'Play again' | t"><ion-icon name="refresh" /></button>
        </div>

        <div class="bottom">
          <div class="stats">
            <span><small>{{ 'Altitude' | t }}</small><b>{{ frame().altitudeFt | number: '1.0-0' }} ft</b></span>
            <span><small>{{ 'Speed' | t }}</small><b>{{ frame().speedKmh | number: '1.0-0' }} km/h</b></span>
          </div>
          <div class="route">
            <b>{{ flight().from.code }}</b>
            <div class="bar"><i [style.width.%]="frame().progress * 100"></i><ion-icon name="airplane" [style.left.%]="frame().progress * 100" /></div>
            <b>{{ flight().to.code }}</b>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: block; margin-bottom: 14px; }
    .stage { position: relative; height: 300px; border-radius: 26px; overflow: hidden; background: #070b1a;
      box-shadow: 0 22px 50px rgba(8, 12, 32, .35), inset 0 0 0 1px rgba(255,255,255,.06); isolation: isolate; }
    canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; opacity: 0; transition: opacity .6s; }
    .ready canvas { opacity: 1; }
    .fade { position: absolute; inset: 0; background: #070b1a; pointer-events: none; }
    .loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
    .spin { width: 26px; height: 26px; border-radius: 50%; border: 3px solid rgba(255,255,255,.25); border-top-color: #22c7d3; animation: spin .8s linear infinite; }
    @keyframes spin { to { rotate: 360deg; } }

    .top { position: absolute; left: 12px; right: 12px; top: 12px; display: flex; justify-content: space-between; align-items: center; }
    .phase { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px 7px 10px; border-radius: 999px; font-size: 12.5px; font-weight: 750; color: #fff;
      background: rgba(10, 16, 36, .55); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,.12);
      animation: pop .45s var(--gm-ease-spring, ease); }
    .phase ion-icon { font-size: 16px; color: #22d3ee; }
    .phase[data-phase='cruise'] ion-icon { color: #a78bfa; }
    .phase[data-phase='landing'] ion-icon { color: #f472b6; }
    .phase[data-phase='arrived'] ion-icon { color: #34d399; }
    @keyframes pop { from { transform: translateY(-6px) scale(.94); opacity: 0; } }
    .replay { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #fff;
      background: rgba(10, 16, 36, .55); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,.12); }
    .replay:active { transform: scale(.9); }

    .bottom { position: absolute; left: 0; right: 0; bottom: 0; padding: 30px 14px 12px; color: #fff;
      background: linear-gradient(to top, rgba(5, 8, 20, .85), transparent); }
    .stats { display: flex; gap: 18px; margin-bottom: 8px; }
    .stats span { display: flex; flex-direction: column; }
    .stats small { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: rgba(203, 213, 225, .8); }
    .stats b { font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .route { display: flex; align-items: center; gap: 10px; }
    .route b { font-size: 14px; font-weight: 850; letter-spacing: .04em; }
    .bar { position: relative; flex: 1; height: 4px; border-radius: 4px; background: rgba(255,255,255,.18); }
    .bar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: linear-gradient(90deg, #22d3ee, #a78bfa, #f472b6); }
    .bar ion-icon { position: absolute; top: 50%; font-size: 16px; color: #fff; transform: translate(-50%, -50%) rotate(0deg); filter: drop-shadow(0 0 6px rgba(34, 211, 238, .9)); }
  `,
})
export class FlightJourneyComponent implements AfterViewInit, OnDestroy {
  readonly flight = input.required<Flight>();
  private canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);
  private airports = inject(AirportDbService);

  readonly ready = signal(false);
  readonly failed = signal(false);
  readonly frame = signal<JourneyFrame>({ phase: 'taxi', progress: 0, altitudeFt: 0, speedKmh: 0, fade: 1 });
  readonly phaseMeta = computed(() => PHASES[this.frame().phase]);

  private scene?: FlightJourneyScene;
  private duration = 18.8;
  private raf = 0;
  private started = 0;
  private elapsed = 0;
  private visible = false;
  private destroyed = false;
  private lastHud = 0;
  private observer?: IntersectionObserver;
  private scrolling = false;
  private scrollTimer?: ReturnType<typeof setTimeout>;
  private unlisten?: () => void;
  private resizer?: ResizeObserver;
  private get reduced(): boolean {
    return (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) || document.documentElement.classList.contains('gm-lite');
  }
  private cost = 0;
  private skip = false;
  private odd = false;

  async ngAfterViewInit() {
    await new Promise<void>((done) => {
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      if (ric) ric(() => done(), { timeout: 1200 });
      else setTimeout(done, 450);
    });
    if (this.destroyed) return;
    try {
      const [mod] = await Promise.all([import('./flight-journey.scene'), this.airports.load()]);
      if (this.destroyed) return;
      const f = this.flight();
      const end = (code: string, city: string) => {
        const a = this.airports.get(code);
        return { code, city: a?.city ?? city, lat: a?.lat ?? 0, lon: a?.lon ?? 0 };
      };
      const cv = this.canvas()?.nativeElement;
      if (!cv) return;
      this.scene = new mod.FlightJourneyScene(cv, end(f.from.code, f.from.city), end(f.to.code, f.to.city));
      this.duration = mod.JOURNEY_SECONDS;
      await this.scene.warm();
      if (this.destroyed) return;
      this.resize();
      this.resizer = new ResizeObserver(() => this.resize());
      this.resizer.observe(cv);
      if (this.reduced) {
        this.elapsed = 10;
        this.draw(performance.now(), true);
      }
      this.ready.set(true);
      this.observer = new IntersectionObserver(([e]) => {
        this.visible = e.isIntersecting;
        if (this.visible && !this.reduced && !this.scrolling) this.play();
        else this.pause();
      }, { threshold: 0.25 });
      this.observer.observe(this.host.nativeElement);
      const content = this.host.nativeElement.closest('ion-content') as (HTMLElement & { getScrollElement?: () => Promise<HTMLElement> }) | null;
      const scroller = await content?.getScrollElement?.();
      if (scroller && !this.destroyed) {
        const onScroll = () => {
          this.scrolling = true;
          this.pause();
          clearTimeout(this.scrollTimer);
          this.scrollTimer = setTimeout(() => {
            this.scrolling = false;
            if (this.visible && !this.reduced) this.play();
          }, 180);
        };
        this.zone.runOutsideAngular(() => scroller.addEventListener('scroll', onScroll, { passive: true }));
        this.unlisten = () => scroller.removeEventListener('scroll', onScroll);
      }
    } catch {
      this.failed.set(true);
    }
  }

  replay() {
    if (!this.scene) return;
    this.scene.restart();
    this.elapsed = 0;
    this.started = 0;
    if (this.reduced) {
      this.elapsed = this.duration;
      this.draw(performance.now(), true);
      return;
    }
    this.play();
  }

  private play() {
    if (this.raf || !this.scene || this.elapsed >= this.duration) return;
    this.started = performance.now() - this.elapsed * 1000;
    this.zone.runOutsideAngular(() => {
      let prev = 0;
      let frames = 0;
      const loop = (now: number) => {
        this.elapsed = Math.min(this.duration, (now - this.started) / 1000);
        if (prev) {
          this.cost = frames < 3 ? now - prev : this.cost * 0.88 + (now - prev) * 0.12;
          frames++;
        }
        prev = now;
        if (frames > 8 && this.cost > 24) {
          if (this.cost > 70) {
            this.raf = 0;
            this.elapsed = this.duration;
            this.draw(performance.now(), true);
            return;
          }
          if (this.scene!.lowerQuality()) {
            frames = 0;
          } else if (!this.skip) {
            this.skip = true;
            frames = 0;
          } else if (this.cost > 34) {
            this.raf = 0;
            this.elapsed = this.duration;
            this.draw(performance.now(), true);
            return;
          }
        }
        this.odd = !this.odd;
        if (!this.skip || this.odd || this.elapsed >= this.duration) this.draw(now, false);
        if (this.elapsed >= this.duration || !this.visible) {
          this.raf = 0;
          return;
        }
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    });
  }

  private pause() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private draw(now: number, force: boolean) {
    const f = this.scene!.render(this.elapsed, now);
    if (force || now - this.lastHud > 80 || f.phase !== this.frame().phase || this.elapsed >= this.duration) {
      this.lastHud = now;
      this.zone.run(() => this.frame.set(f));
    }
  }

  private resize() {
    const cv = this.canvas()?.nativeElement;
    if (!cv || !this.scene) return;
    const r = cv.getBoundingClientRect();
    if (r.width && r.height) {
      this.scene.resize(r.width, r.height);
      if (!this.raf) this.scene.render(this.elapsed, performance.now());
    }
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.pause();
    this.observer?.disconnect();
    this.unlisten?.();
    clearTimeout(this.scrollTimer);
    this.resizer?.disconnect();
    this.scene?.dispose();
  }
}
