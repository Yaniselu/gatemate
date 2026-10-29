import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButtons, IonContent, IonHeader, IonIcon, IonRefresher, IonRefresherContent, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { ChatService } from '../../core/services/chat.service';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { PressableDirective } from '../../shared/directives/pressable.directive';
import { RelativeTimePipe } from '../../shared/pipes/time.pipes';
import { PlatformService } from '../../core/services/platform.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';

@Component({
  selector: 'gm-chat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonIcon, IonRefresher, IonRefresherContent, RouterLink, SkeletonComponent, RevealDirective, PressableDirective, RelativeTimePipe],
  templateUrl: './chat.page.html',
  styleUrl: './chat.page.scss',
})
export class ChatPage implements OnInit {
  protected chat = inject(ChatService);
  private platform = inject(PlatformService);

  readonly query = signal('');
  readonly filter = signal<'all' | 'groups' | 'lounges'>('all');
  readonly filters = [
    { id: 'all', label: 'All' },
    { id: 'groups', label: 'Trip groups' },
    { id: 'lounges', label: 'Flight lounges' },
  ] as const;

  readonly threads = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.chat
      .threads()
      .filter((t) => (this.filter() === 'groups' ? !t.isPublic : this.filter() === 'lounges' ? t.isPublic : true))
      .filter((t) => !q || t.title.toLowerCase().includes(q));
  });

  ngOnInit(): void {
    void this.chat.loadThreads();
  }

  /** Coming back to the tab (e.g. after creating a group or adding a trip): show new chats straight away. */
  ionViewWillEnter(): void {
    if (this.chat.threadsState() === 'ready') void this.chat.loadThreads(true);
  }

  setFilter(f: 'all' | 'groups' | 'lounges') {
    this.platform.selection();
    this.filter.set(f);
  }

  onSearch(ev: Event) {
    this.query.set((ev.target as HTMLInputElement).value.slice(0, 60));
  }

  async refresh(ev: CustomEvent) {
    await this.chat.loadThreads(true);
    (ev.target as HTMLIonRefresherElement).complete();
  }
}
