import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { IonContent, NavController } from '@ionic/angular/standalone';
import { PlaneComponent } from '../../shared/components/plane.component';
import { SwipeButtonComponent } from '../../shared/components/swipe-button.component';
import { PlatformService } from '../../core/services/platform.service';
import { PrefsService } from '../../core/services/prefs.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';

@Component({
  selector: 'gm-welcome',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonContent, PlaneComponent, SwipeButtonComponent],
  templateUrl: './welcome.page.html',
  styleUrl: './welcome.page.scss',
})
export class WelcomePage {
  private nav = inject(NavController);
  private platform = inject(PlatformService);
  private prefs = inject(PrefsService);

  private plane = viewChild.required<ElementRef<HTMLElement>>('plane');
  private reveal = viewChild.required<ElementRef<HTMLElement>>('reveal');

  readonly takingOff = signal(false);
  readonly title = 'Gatemate'.split('');
  readonly stars = Array.from({ length: 46 }, (_, i) => {
    const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
    return { x: r(1) * 100, y: r(2) * 62, s: 1 + r(3) * 2.2, d: r(4) * 4, t: 2.4 + r(5) * 3 };
  });

  readonly pitches = [
    { icon: '✨', text: 'Velo, your AI travel agent by Velosyntech' },
    { icon: '🎫', text: 'Boarding passes that work offline' },
    { icon: '🔔', text: 'Gate, boarding and delay alerts' },
    { icon: '🗺️', text: 'Detailed airport maps to your gate' },
    { icon: '🧭', text: 'City guides, phrases and money tips' },
    { icon: '🌍', text: 'Your travel passport and world map' },
    { icon: '🎮', text: 'Games for the flight, no Wi-Fi needed' },
  ];
  readonly pitch = signal(0);

  constructor() {
    const t = setInterval(() => this.pitch.update((i) => (i + 1) % this.pitches.length), 2600);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  async takeOff(): Promise<void> {
    if (this.takingOff()) return;
    this.takingOff.set(true);
    void this.prefs.setOnboarded();

    if (this.platform.reducedMotion) {
      await this.go();
      return;
    }

    const plane = this.plane().nativeElement;
    const reveal = this.reveal().nativeElement;

    const flight = plane.animate(
      [
        { transform: 'translate3d(0,0,0) rotate(0deg) scale(1)', offset: 0 },
        { transform: 'translate3d(-14px,10px,0) rotate(2deg) scale(1)', offset: 0.14 },
        { transform: 'translate3d(40px,-10px,0) rotate(-10deg) scale(1.05)', offset: 0.38 },
        { transform: 'translate3d(140vw,-85vh,0) rotate(-24deg) scale(1.7)', offset: 1 },
      ],
      { duration: 2000, easing: 'cubic-bezier(0.5, 0, 0.75, 0.25)', fill: 'forwards' },
    );

    setTimeout(() => this.platform.tap(), 450);
    setTimeout(() => this.platform.impact(), 900);

    const open = reveal.animate(
      [
        { clipPath: 'circle(0% at 92% 4%)', opacity: 1 },
        { clipPath: 'circle(150% at 92% 4%)', opacity: 1 },
      ],
      { duration: 650, delay: 1450, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' },
    );

    await Promise.all([flight.finished, open.finished]);
    this.platform.success();
    await this.go();
  }

  private go() {
    return this.nav.navigateRoot('/auth/login', { animated: false });
  }
}
