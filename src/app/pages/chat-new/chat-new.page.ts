import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, NavController } from '@ionic/angular/standalone';
import { ApiError, GatemateApi } from '../../core/services/api';
import { ChatService } from '../../core/services/chat.service';
import { TravelStore } from '../../core/services/travel.store';
import { PlatformService } from '../../core/services/platform.service';
import { ChatThread } from '../../core/models';
import { cleanText } from '../../core/security/sanitize';
import { InvitePanelComponent } from '../../shared/components/invite-panel.component';
import { ConfettiService } from '../../shared/components/confetti.service';
import { AchievementsService } from '../../core/services/achievements.service';
import { t as tr, TranslatePipe } from '../../core/i18n/i18n.service';

const EMOJIS = ['🏖️', '🏔️', '🏙️', '🎉', '⚽', '🎿', '🍝', '🌴', '💼', '🎓', '❤️', '✈️'];

@Component({
  selector: 'gm-chat-new',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, FormsModule, InvitePanelComponent],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/chat" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>{{ created() ? ('Invite friends' | t) : ('New trip group' | t) }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <div class="page">
        @if (!created()) {
          <div class="preview anim-scale-in">
            <span class="avatar" [class.bump]="bump()">{{ emoji() }}</span>
            <b>{{ title().trim() || ('Your group' | t) }}</b>
            <small>{{ tripTitle() }}</small>
          </div>

          <div class="gm-field">
            <label for="gname">{{ 'Group name' | t }}</label>
            <div class="gm-input-wrap"><ion-icon name="people-outline" /><input id="gname" [ngModel]="title()" (ngModelChange)="title.set($event)" maxlength="40" [placeholder]="'Barcelona squad' | t" /></div>
          </div>

          <span class="gm-label lbl">{{ 'Pick an icon' | t }}</span>
          <div class="emojis">
            @for (e of emojis; track e; let i = $index) {
              <button [class.on]="emoji() === e" (click)="pickEmoji(e)" [style.--i]="i" [attr.aria-label]="'Icon {e}' | t: { e }">{{ e }}</button>
            }
          </div>

          <span class="gm-label lbl">{{ 'Link to a trip (optional)' | t }}</span>
          <div class="trips">
            <button [class.on]="!tripId()" (click)="tripId.set(null)">{{ 'No trip' | t }}</button>
            @for (t of store.upcomingTrips(); track t.id) {
              <button [class.on]="tripId() === t.id" (click)="tripId.set(t.id); title() || title.set(t.title)">{{ t.destination.city }}</button>
            }
          </div>

          @if (error()) {
            <p class="err anim-fade-up" role="alert"><ion-icon name="alert-circle" /> {{ error() }}</p>
          }
          <button class="gm-btn" (click)="create()" [disabled]="busy()">
            @if (busy()) { <i class="spin"></i> {{ 'Creating…' | t }} } @else { <ion-icon name="add" /> {{ 'Create group' | t }} }
          </button>
        } @else {
          @if (created(); as c) {
            <div class="created anim-scale-in">
              <span class="avatar big">{{ c.emoji }}</span>
              <h2>{{ c.title | t }} is ready</h2>
              <p>{{ 'Invite your travel buddies — they’ll join the chat and see the shared trip.' | t }}</p>
            </div>
            <gm-invite-panel [targetId]="c.id" [title]="c.title" />
            <button class="gm-btn ghost open" (click)="open(c)"><ion-icon name="chatbubbles-outline" /> {{ 'Open chat' | t }}</button>
          }
        }
      </div>
    </ion-content>
  `,
  styles: `
    .page { padding: 10px 16px 40px; max-width: 540px; margin: 0 auto; }
    .preview, .created { display: flex; flex-direction: column; align-items: center; gap: 4px; margin: 6px 0 20px; text-align: center; }
    .avatar { width: 84px; height: 84px; border-radius: 28px; display: flex; align-items: center; justify-content: center; font-size: 42px; background: linear-gradient(135deg, #e6f8fa, #fff); border: 1px solid var(--gm-card-border); box-shadow: var(--gm-card-shadow); margin-bottom: 8px; }
    .avatar.bump { animation: gm-bounce-icon .5s var(--gm-ease-spring); }
    .avatar.big { width: 104px; height: 104px; font-size: 52px; animation: gm-pop .6s var(--gm-ease-spring); }
    .preview b { font-size: 18px; }
    .preview small { color: var(--gm-ink-3); }
    .created h2 { margin: 6px 0 4px; font-size: 22px; font-weight: 800; }
    .created p { color: var(--gm-ink-3); margin: 0 0 8px; line-height: 1.45; }
    .lbl { margin: 6px 4px 8px; }
    .emojis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 18px; }
    .emojis button { aspect-ratio: 1; border-radius: 14px; font-size: 24px; background: var(--gm-card-bg); border: 1px solid var(--gm-card-border); transition: transform .3s var(--gm-ease-spring), border-color .2s; animation: gm-scale-in .35s var(--gm-ease-spring) both; animation-delay: calc(var(--i) * 25ms); }
    .emojis button.on { border-color: var(--gm-accent); transform: scale(1.1); box-shadow: 0 0 0 4px rgba(var(--gm-accent-rgb), .12); }
    .trips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; }
    .trips button { padding: 9px 14px; border-radius: 999px; background: var(--gm-surface); font-weight: 650; font-size: 14px; color: var(--gm-ink-2); transition: all .3s var(--gm-ease-spring); }
    .trips button.on { background: var(--gm-navy); color: #fff; }
    .open { margin-top: 18px; }
    .err { display: flex; gap: 6px; align-items: center; margin: -8px 4px 14px; color: #c0392b; font-size: 14px; font-weight: 600; }
    .spin { width: 20px; height: 20px; border-radius: 50%; border: 2.5px solid rgba(255,255,255,.35); border-top-color: #fff; animation: gm-spin .8s linear infinite; }
  `,
})
export class ChatNewPage implements OnInit {
  private api = inject(GatemateApi);
  private chat = inject(ChatService);
  protected store = inject(TravelStore);
  private platform = inject(PlatformService);
  private confetti = inject(ConfettiService);
  private achievements = inject(AchievementsService);
  private nav = inject(NavController);

  readonly emojis = EMOJIS;
  readonly title = signal('');
  readonly emoji = signal(EMOJIS[0]);
  readonly tripId = signal<string | null>(null);
  readonly busy = signal(false);
  readonly bump = signal(false);
  readonly created = signal<ChatThread | null>(null);
  readonly error = signal('');

  ngOnInit() {
    void this.store.loadTrips();
  }

  tripTitle() {
    const t = this.store.upcomingTrips().find((x) => x.id === this.tripId());
    return t ? tr('Linked to {trip}', { trip: t.title }) : tr('Private group · only invited people');
  }

  pickEmoji(e: string) {
    this.platform.selection();
    this.emoji.set(e);
    this.bump.set(false);
    requestAnimationFrame(() => this.bump.set(true));
  }

  async create() {
    const trip = this.store.upcomingTrips().find((x) => x.id === this.tripId());
    // No name typed: use the trip's name, or a friendly default, instead of a dead button.
    const title = cleanText(this.title(), 40) || trip?.title.slice(0, 40) || 'Travel group';
    this.error.set('');
    this.busy.set(true);
    try {
      const thread = await this.api.createThread({ title, emoji: this.emoji(), tripId: this.tripId() ?? undefined });
      this.chat.threads.update((ts) => [thread, ...ts.filter((t) => t.id !== thread.id)]);
      this.created.set(thread);
      this.platform.success();
      this.confetti.burst(0.5, 0.25, 60);
      void this.achievements.track('group_created');
    } catch (e) {
      this.platform.error();
      this.error.set(e instanceof ApiError && e.message ? e.message : 'Could not create the group. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }

  open(c: ChatThread) {
    void this.nav.navigateForward(['/chat', c.id], { replaceUrl: true });
  }
}
