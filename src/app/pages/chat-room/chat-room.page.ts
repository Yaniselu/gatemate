import { ChangeDetectionStrategy, Component, computed, effect, inject, input, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionSheetController, AlertController, IonBackButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonToolbar, NavController } from '@ionic/angular/standalone';
import { ChatService } from '../../core/services/chat.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { PlatformService } from '../../core/services/platform.service';
import { ChatMessage } from '../../core/models';
import { containsLink, containsSensitiveNumber, MAX_MESSAGE_LENGTH } from '../../core/security/sanitize';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { ClockPipe } from '../../shared/pipes/time.pipes';

interface Row {
  kind: 'day' | 'msg';
  key: string;
  label?: string;
  msg?: ChatMessage;
  mine?: boolean;
  first?: boolean;
}

const REPORT_REASONS = ['Spam or scam', 'Harassment or hate', 'Sexual content', 'Sharing personal data', 'Something else'];

@Component({
  selector: 'gm-chat-room',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonToolbar, IonButtons, IonBackButton, IonFooter, IonIcon, FormsModule, SkeletonComponent, ClockPipe],
  templateUrl: './chat-room.page.html',
  styleUrl: './chat-room.page.scss',
})
export class ChatRoomPage implements OnInit {
  readonly id = input.required<string>();

  protected chat = inject(ChatService);
  private auth = inject(AuthService);
  private sheet = inject(ActionSheetController);
  private alerts = inject(AlertController);
  private toast = inject(ToastService);
  private platform = inject(PlatformService);
  private nav = inject(NavController);
  private content = viewChild(IonContent);

  readonly maxLength = MAX_MESSAGE_LENGTH;
  readonly draft = signal('');
  readonly loaded = signal(false);
  readonly thread = computed(() => this.chat.thread(this.id()));
  readonly typing = computed(() => this.chat.typing()[this.id()] ?? null);
  readonly warning = computed(() => {
    const d = this.draft();
    if (containsSensitiveNumber(d)) return 'This looks like a card number. Never share payment details in chat.';
    if (this.thread()?.isPublic && containsLink(d)) return 'Links in public lounges are reviewed. Only share links you trust.';
    return null;
  });

  readonly rows = computed<Row[]>(() => {
    const list = this.chat.messages()[this.id()] ?? [];
    const rows: Row[] = [];
    let lastDay = '';
    let lastAuthor = '';
    for (const m of list) {
      const day = new Date(m.createdAt).toDateString();
      if (day !== lastDay) {
        rows.push({ kind: 'day', key: 'd' + day, label: dayLabel(m.createdAt) });
        lastDay = day;
        lastAuthor = '';
      }
      rows.push({ kind: 'msg', key: m.id, msg: m, mine: m.authorId === 'me', first: m.authorId !== lastAuthor });
      lastAuthor = m.authorId;
    }
    return rows;
  });

  constructor() {
    // Keep the latest message in view.
    effect(() => {
      this.rows();
      this.typing();
      setTimeout(() => this.content()?.scrollToBottom(300), 30);
    });
  }

  async ngOnInit() {
    await this.chat.loadThreads();
    await this.chat.loadMessages(this.id());
    this.loaded.set(true);
  }

  async send() {
    const text = this.draft();
    if (!text.trim()) return;
    this.draft.set('');
    this.platform.tap();
    const res = await this.chat.send(this.id(), text, this.auth.user()?.name ?? 'You');
    if (!res.ok && res.reason) await this.toast.show(res.reason, 'error');
  }

  onKey(ev: KeyboardEvent) {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      void this.send();
    }
  }

  async messageActions(m: ChatMessage) {
    this.platform.impact();
    const mine = m.authorId === 'me';
    const sheet = await this.sheet.create({
      header: mine ? 'Your message' : m.authorName,
      cssClass: 'gm-sheet',
      buttons: [
        { text: 'Copy text', icon: 'copy-outline', handler: () => void navigator.clipboard?.writeText(m.text).catch(() => {}) },
        ...(m.status === 'failed' ? [{ text: 'Retry sending', icon: 'refresh-outline', handler: () => void this.chat.retry(this.id(), m, this.auth.user()?.name ?? 'You') }] : []),
        ...(!mine
          ? [
              { text: 'Report message', icon: 'flag-outline', role: 'destructive', handler: () => void this.report(m) },
              { text: `Block ${m.authorName.split(' ')[0]}`, icon: 'hand-left-outline', role: 'destructive', handler: () => void this.block(m) },
            ]
          : []),
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  private async report(m: ChatMessage) {
    const alert = await this.alerts.create({
      header: 'Report message',
      message: 'Our moderation team reviews reports within 24 hours.',
      inputs: REPORT_REASONS.map((r, i) => ({ type: 'radio' as const, label: r, value: r, checked: i === 0 })),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Report', handler: (reason: string) => void this.chat.report(m.id, reason).then(() => this.toast.show('Thanks — we will review it.', 'success')) },
      ],
    });
    await alert.present();
  }

  private async block(m: ChatMessage) {
    const alert = await this.alerts.create({
      header: `Block ${m.authorName}?`,
      message: 'You will no longer see their messages, and they will not be able to contact you.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Block', role: 'destructive', handler: () => void this.chat.block(this.id(), m.authorId).then(() => this.toast.show(`${m.authorName.split(' ')[0]} is blocked`, 'success')) },
      ],
    });
    await alert.present();
  }

  async threadMenu() {
    const t = this.thread();
    if (!t) return;
    const sheet = await this.sheet.create({
      header: t.title,
      cssClass: 'gm-sheet',
      buttons: [
        { text: t.muted ? 'Unmute notifications' : 'Mute notifications', icon: t.muted ? 'volume-high-outline' : 'volume-mute-outline', handler: () => this.chat.toggleMute(t.id) },
        { text: 'Community Guidelines', icon: 'shield-checkmark-outline', handler: () => void this.nav.navigateForward('/legal/guidelines') },
        { text: t.isPublic ? 'Leave lounge' : 'Leave group', icon: 'exit-outline', role: 'destructive', handler: () => void this.leave() },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  private async leave() {
    await this.chat.leave(this.id());
    await this.toast.show('You left the chat');
    await this.nav.navigateBack('/tabs/chat');
  }

  // Long-press detection for message actions
  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  pressStart(m: ChatMessage) {
    this.pressTimer = setTimeout(() => this.messageActions(m), 480);
  }
  pressEnd() {
    if (this.pressTimer) clearTimeout(this.pressTimer);
    this.pressTimer = null;
  }
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}
