import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonRefresher, IonRefresherContent, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { TravelStore } from '../../core/services/travel.store';
import { Trip } from '../../core/models';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { AvatarStackComponent } from '../../shared/components/avatar-stack.component';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { PressableDirective } from '../../shared/directives/pressable.directive';
import { ShortDatePipe } from '../../shared/pipes/time.pipes';
import { PlatformService } from '../../core/services/platform.service';

@Component({
  selector: 'gm-trips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonFab, IonFabButton, IonRefresher, IonRefresherContent,
    RouterLink, SkeletonComponent, AvatarStackComponent, RevealDirective, PressableDirective, ShortDatePipe,
  ],
  templateUrl: './trips.page.html',
  styleUrl: './trips.page.scss',
})
export class TripsPage implements OnInit {
  protected store = inject(TravelStore);
  private platform = inject(PlatformService);

  readonly segment = signal<'upcoming' | 'past'>('upcoming');
  readonly list = computed(() => (this.segment() === 'upcoming' ? this.store.upcomingTrips() : this.store.pastTrips()));

  ngOnInit(): void {
    void this.store.loadTrips();
  }

  select(s: 'upcoming' | 'past') {
    if (s !== this.segment()) this.platform.selection();
    this.segment.set(s);
  }

  async refresh(ev: CustomEvent) {
    await this.store.loadTrips(true);
    (ev.target as HTMLIonRefresherElement).complete();
  }

  /** Calendar-day countdown: "Today", "Tomorrow", "in 5 days", or "Now" once the trip started. */
  countdownLabel(t: Trip): string {
    const start = new Date(t.startDate);
    if (start.getTime() <= Date.now()) return 'Happening now';
    const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((midnight(start) - midnight(new Date())) / 86_400_000);
    return days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `in ${days} days`;
  }

  checklistProgress(t: Trip): number {
    return t.checklist.length ? t.checklist.filter((c) => c.done).length / t.checklist.length : 0;
  }
}
