import { chatIcon } from '../../shared/utils/chat-icon';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActionSheetController, AlertController, NavController, IonButtons, IonContent, IonHeader, IonIcon, IonRefresher, IonRefresherContent, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { ChatService } from '../../core/services/chat.service';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { PressableDirective } from '../../shared/directives/pressable.directive';
import { RelativeTimePipe } from '../../shared/pipes/time.pipes';
import { PlatformService } from '../../core/services/platform.service';
import { t as tr, TranslatePipe } from '../../core/i18n/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { ChatThread } from '../../core/models';

@Component({
  selector: 'gm-chat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonIcon, IonRefresher, IonRefresherContent, RouterLink, SkeletonComponent, RevealDirective, PressableDirective, RelativeTimePipe],
  templateUrl: './chat.page.html',
  styleUrl: './chat.page.scss',
})
export class ChatPage implements OnInit {
  protected icon = chatIcon;
  protected chat = inject(ChatService);
  private platform = inject(PlatformService);
  private sheets = inject(ActionSheetController);
  private nav = inject(NavController);
  private alerts = inject(AlertController);
  private toast = inject(ToastService);

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

  readonly opened = signal<string | null>(null);
  readonly dragging = signal<string | null>(null);
  private drag = signal<Record<string, number>>({});
  private startX = 0;
  private startY = 0;
  private moved = false;
  private press?: ReturnType<typeof setTimeout>;

  offset(id: string) {
    const d = this.drag()[id];
    if (d !== undefined) return d;
    return this.opened() === id ? -92 : 0;
  }

  down(e: PointerEvent, id: string) {
    const end = () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      this.up(id);
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.moved = false;
    if (this.opened() && this.opened() !== id) this.opened.set(null);
    clearTimeout(this.press);
    this.press = setTimeout(() => {
      if (!this.moved) {
        const t = this.chat.threads().find((x) => x.id === id);
        if (t) void this.menu(t);
        this.moved = true;
      }
    }, 550);
  }

  move(e: PointerEvent, id: string) {
    const dx = e.clientX - this.startX, dy = e.clientY - this.startY;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearTimeout(this.press);
    if (Math.abs(dy) > Math.abs(dx) && !this.dragging()) return;
    if (Math.abs(dx) < 8) return;
    this.moved = true;
    this.dragging.set(id);
    const base = this.opened() === id ? -92 : 0;
    this.drag.update((d) => ({ ...d, [id]: Math.max(-120, Math.min(0, base + dx)) }));
  }

  up(id: string) {
    clearTimeout(this.press);
    const d = this.drag()[id];
    this.dragging.set(null);
    this.drag.update((x) => {
      const n = { ...x };
      delete n[id];
      return n;
    });
    if (d === undefined) return;
    if (d < -46) {
      this.opened.set(id);
      this.platform.selection();
    } else if (this.opened() === id) this.opened.set(null);
  }

  tap(e: Event, id: string) {
    e.preventDefault();
    if (this.moved) {
      this.moved = false;
      return;
    }
    if (this.opened()) {
      this.opened.set(null);
      return;
    }
    void this.nav.navigateForward(['/chat', id]);
  }

  async menu(t: ChatThread) {
    this.platform.impact();
    const sheet = await this.sheets.create({
      header: tr(t.title),
      cssClass: 'gm-sheet',
      buttons: [
        { text: t.muted ? tr('Unmute') : tr('Mute'), icon: t.muted ? 'volume-high-outline' : 'volume-mute-outline', handler: () => this.chat.toggleMute(t.id) },
        { text: tr('Delete chat'), icon: 'trash-outline', role: 'destructive', handler: () => void this.remove(t) },
        { text: tr('Cancel'), role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  async remove(t: ChatThread) {
    const a = await this.alerts.create({
      header: tr('Delete “{name}”?', { name: tr(t.title) }),
      message: t.isPublic ? tr('You’ll leave this lounge. You can join again from your flight.') : tr('You’ll leave the group and it disappears from your chats. Others keep their copy.'),
      buttons: [{ text: tr('Cancel'), role: 'cancel' }, { text: tr('Delete'), role: 'destructive' }],
    });
    await a.present();
    if ((await a.onDidDismiss()).role !== 'destructive') {
      this.opened.set(null);
      return;
    }
    try {
      await this.chat.leave(t.id);
      this.opened.set(null);
      this.platform.success();
    } catch {
      void this.toast.show('Couldn’t delete this chat. Try again.', 'error');
    }
  }

  async refresh(ev: CustomEvent) {
    await this.chat.loadThreads(true);
    (ev.target as HTMLIonRefresherElement).complete();
  }
}
