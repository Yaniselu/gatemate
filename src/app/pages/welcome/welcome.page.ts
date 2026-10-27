import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, NavController } from '@ionic/angular/standalone';
import { PlaneComponent } from '../../shared/components/plane.component';
import { PlatformService } from '../../core/services/platform.service';
import { PrefsService } from '../../core/services/prefs.service';

@Component({
  selector: 'gm-welcome',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonIcon, PlaneComponent, RouterLink],
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
  readonly features = [
    { icon: 'notifications', label: 'Boarding alerts' },
    { icon: 'ticket', label: 'Boarding passes' },
    { icon: 'chatbubbles', label: 'Trip chats' },
    { icon: 'map', label: 'Airport guide' },
  ];

  async takeOff(): Promise<void> {
    if (this.takingOff()) return;
    this.takingOff.set(true);
    this.platform.impact();
    void this.prefs.setOnboarded();

    if (this.platform.reducedMotion) {
      await this.go();
      return;
    }

    const plane = this.plane().nativeElement;
    const reveal = this.reveal().nativeElement;

    // 1. Roll + rotate nose up, 2. climb out of frame to the top-right.
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

    // 3. White sky "opens" from the top-right corner where the plane exits.
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
