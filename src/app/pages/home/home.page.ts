import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonIcon, IonRefresher, IonRefresherContent, IonTitle, IonToolbar, NavController } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { TravelStore } from '../../core/services/travel.store';
import { ChatService } from '../../core/services/chat.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { AlertKind } from '../../core/models';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { CountdownComponent } from '../../shared/components/countdown.component';
import { RouteArcComponent } from '../../shared/components/route-arc.component';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { PressableDirective } from '../../shared/directives/pressable.directive';
import { ClockPipe, DurationPipe, RelativeTimePipe } from '../../shared/pipes/time.pipes';
import { FlightStatusPipe } from '../../shared/pipes/status.pipe';

export const ALERT_ICONS: Record<AlertKind, { icon: string; color: string }> = {
  boarding: { icon: 'airplane', color: '#0FB5C3' },
  gate: { icon: 'navigate-outline', color: '#8B7CF6' },
  delay: { icon: 'time-outline', color: '#FFB020' },
  checkin: { icon: 'checkmark-circle', color: '#2FD18A' },
  baggage: { icon: 'bag-handle-outline', color: '#FF8A5B' },
  chat: { icon: 'chatbubbles', color: '#5EC8FF' },
  info: { icon: 'information-circle', color: '#74859A' },
};

@Component({
  selector: 'gm-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonRefresher, IonRefresherContent, RouterLink,
    SkeletonComponent, CountdownComponent, RouteArcComponent, RevealDirective, PressableDirective,
    ClockPipe, DurationPipe, RelativeTimePipe, FlightStatusPipe,
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage implements OnInit {
  protected auth = inject(AuthService);
  protected store = inject(TravelStore);
  private chat = inject(ChatService);
  private notifications = inject(NotificationsService);
  private nav = inject(NavController);

  protected readonly alertIcons = ALERT_ICONS;
  private now = signal(Date.now());

  readonly greeting = computed(() => {
    const h = new Date(this.now()).getHours();
    return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  });
  readonly today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  readonly next = this.store.nextFlight;
  readonly loading = computed(() => this.store.tripsState() !== 'ready');

  readonly steps = ['Check-in', 'Security', 'Gate', 'Boarding', 'Take-off'];
  readonly stepIndex = computed(() => {
    const f = this.next()?.flight;
    if (!f) return 0;
    const toDep = new Date(f.departure).getTime() - this.now();
    const toBoard = new Date(f.boardingTime).getTime() - this.now();
    if (toDep <= 0) return 4;
    if (toBoard <= 0) return 3;
    if (toDep <= 60 * 60_000) return 2;
    if (toDep <= 3 * 60 * 60_000) return 1;
    return 0;
  });
  readonly flightProgress = computed(() => {
    const f = this.next()?.flight;
    if (!f) return 0;
    const dep = new Date(f.departure).getTime();
    const arr = new Date(f.arrival).getTime();
    return Math.max(0, Math.min(1, (this.now() - dep) / (arr - dep)));
  });

  readonly actions = [
    { label: 'Add flight', icon: 'scan-outline', link: '/add-flight', color: '#0FB5C3' },
    { label: 'Boarding pass', icon: 'qr-code-outline', link: 'pass', color: '#8B7CF6' },
    { label: 'Airport', icon: 'map-outline', link: '/tabs/airport', color: '#FF8A5B' },
    { label: 'Trip chat', icon: 'chatbubbles-outline', link: '/tabs/chat', color: '#5EC8FF' },
    { label: 'Checklist', icon: 'checkmark-done', link: 'checklist', color: '#2FD18A' },
    { label: 'Your rights', icon: 'shield-checkmark-outline', link: '/rights', color: '#FFB020' },
  ];

  readonly tips = [
    { title: 'Liquids rule', body: 'Containers up to 100 ml, in one clear 1 L bag.', icon: 'water-outline', bg: 'linear-gradient(135deg,#22C7D3,#5EC8FF)' },
    { title: 'Power banks', body: 'Cabin bag only — never in checked luggage.', icon: 'battery-charging-outline', bg: 'linear-gradient(135deg,#8B7CF6,#5EC8FF)' },
    { title: 'Arrive early', body: '2 h for Schengen, 3 h for long-haul flights.', icon: 'time-outline', bg: 'linear-gradient(135deg,#FFB36B,#FF6B8B)' },
    { title: 'Stay hydrated', body: 'Cabin air is dry — refill a bottle after security.', icon: 'heart-outline', bg: 'linear-gradient(135deg,#2FD18A,#22C7D3)' },
  ];

  constructor() {
    const id = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  ngOnInit(): void {
    void this.load();
  }

  private async load(force = false) {
    await Promise.all([this.store.loadTrips(force), this.store.loadAlerts(force), this.chat.loadThreads(force)]);
    const next = this.next();
    if (next) void this.notifications.scheduleForFlight(next.flight);
  }

  async refresh(ev: CustomEvent) {
    await this.load(true);
    (ev.target as HTMLIonRefresherElement).complete();
  }

  open(link: string) {
    const next = this.next();
    if ((link === 'pass' || link === 'checklist') && next) {
      void this.nav.navigateForward(`/trip/${next.trip.id}`, { queryParams: { tab: link === 'pass' ? 'pass' : 'checklist' } });
    } else if (link === 'pass' || link === 'checklist') {
      void this.nav.navigateForward('/add-flight');
    } else {
      void this.nav.navigateForward(link);
    }
  }
}
