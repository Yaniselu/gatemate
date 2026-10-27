import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, NavController } from '@ionic/angular/standalone';
import { GatemateApi } from '../../core/services/api';
import { AuthService } from '../../core/services/auth.service';
import { PlatformService } from '../../core/services/platform.service';
import { ToastService } from '../../core/services/toast.service';
import { cleanText } from '../../core/security/sanitize';
import { AchievementsService } from '../../core/services/achievements.service';

@Component({
  selector: 'gm-feedback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, FormsModule],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/profile" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>Send feedback</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <div class="page">
        @if (!sent()) {
          <h1 class="anim-fade-up">How can we make Gatemate better?</h1>
          <p class="muted anim-fade-up">Goes straight to the team. We read every message.</p>

          <span class="gm-label lbl">How’s your experience so far?</span>
          <div class="faces">
            @for (f of faces; track f.v) {
              <button [class.on]="rating() === f.v" (click)="rate(f.v)" [attr.aria-label]="f.label"><span>{{ f.e }}</span><small>{{ f.label }}</small></button>
            }
          </div>

          <span class="gm-label lbl">What is it about?</span>
          <div class="topics">
            @for (t of topics; track t) { <button [class.on]="topic() === t" (click)="topic.set(t)">{{ t }}</button> }
          </div>

          <div class="gm-field">
            <label for="msg">Tell us more <small>{{ message().length }}/1000</small></label>
            <div class="gm-input-wrap area"><textarea id="msg" rows="5" maxlength="1000" [ngModel]="message()" (ngModelChange)="message.set($event)" placeholder="What happened, and what did you expect?"></textarea></div>
          </div>

          <label class="check">
            <input type="checkbox" [ngModel]="contact()" (ngModelChange)="contact.set($event)" />
            <span>You may reply to me at <b>{{ auth.user()?.email }}</b></span>
          </label>

          <button class="gm-btn" (click)="send()" [disabled]="busy() || message().trim().length < 5"><ion-icon name="send" /> Send feedback</button>
        } @else {
          <div class="thanks anim-scale-in">
            <div class="heart"><ion-icon name="heart" /></div>
            <h1>Thank you!</h1>
            <p class="muted">Your feedback helps every traveller on Gatemate.</p>
            <button class="gm-btn ghost" (click)="nav.back()">Done</button>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .page { padding: 10px 18px 40px; max-width: 540px; margin: 0 auto; }
    h1 { font-size: 24px; font-weight: 800; margin: 8px 0 4px; }
    .muted { color: var(--gm-ink-3); margin: 0 0 16px; }
    .lbl { margin: 18px 4px 8px; }
    .faces { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
    .faces button { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 2px; border-radius: 14px; background: #fff; border: 1px solid var(--gm-card-border); transition: transform .3s var(--gm-ease-spring), border-color .2s; }
    .faces span { font-size: 28px; filter: grayscale(.6); transition: filter .2s, transform .3s var(--gm-ease-spring); }
    .faces small { font-size: 10.5px; color: var(--gm-ink-3); font-weight: 600; }
    .faces button.on { border-color: var(--gm-accent); transform: translateY(-3px); box-shadow: 0 8px 18px rgba(var(--gm-accent-rgb), .18); }
    .faces button.on span { filter: none; transform: scale(1.2); }
    .topics { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
    .topics button { padding: 8px 13px; border-radius: 999px; background: var(--gm-surface); font-weight: 600; font-size: 13.5px; color: var(--gm-ink-2); transition: all .25s var(--gm-ease-spring); }
    .topics button.on { background: var(--gm-navy); color: #fff; }
    .gm-input-wrap.area { height: auto; }
    .gm-input-wrap.area textarea { padding: 12px 14px; resize: none; line-height: 1.45; }
    label small { float: right; color: var(--gm-ink-3); font-weight: 500; }
    .check { display: flex; gap: 10px; align-items: center; font-size: 14px; color: var(--gm-ink-2); margin: 6px 0 18px; }
    .check input { width: 20px; height: 20px; accent-color: var(--gm-accent); }
    .thanks { text-align: center; padding-top: 40px; }
    .heart { width: 90px; height: 90px; margin: 0 auto 12px; border-radius: 30px; display: flex; align-items: center; justify-content: center; font-size: 44px; color: #fff; background: linear-gradient(135deg, #ff8a9a, #ff5a5f); box-shadow: 0 16px 32px rgba(255,90,95,.3); animation: beat 1.2s ease-in-out infinite; }
    @keyframes beat { 0%, 100% { transform: scale(1); } 15% { transform: scale(1.12); } 30% { transform: scale(1); } 45% { transform: scale(1.08); } }
  `,
})
export class FeedbackPage {
  private api = inject(GatemateApi);
  protected auth = inject(AuthService);
  private platform = inject(PlatformService);
  private toast = inject(ToastService);
  protected nav = inject(NavController);
  private achievements = inject(AchievementsService);

  readonly faces = [
    { v: 1, e: '😣', label: 'Bad' },
    { v: 2, e: '😕', label: 'Meh' },
    { v: 3, e: '😐', label: 'OK' },
    { v: 4, e: '🙂', label: 'Good' },
    { v: 5, e: '😍', label: 'Love it' },
  ];
  readonly topics = ['Something’s broken', 'Feature idea', 'Flight data', 'Chat', 'Design', 'Other'];
  readonly rating = signal<number | null>(null);
  readonly topic = signal('Feature idea');
  readonly message = signal('');
  readonly contact = signal(true);
  readonly busy = signal(false);
  readonly sent = signal(false);

  rate(v: number) {
    this.platform.selection();
    this.rating.set(v);
  }

  async send() {
    const message = cleanText(this.message(), 1000);
    if (message.length < 5) return;
    this.busy.set(true);
    try {
      await this.api.sendFeedback({ topic: this.topic(), message, rating: this.rating() ?? undefined, contactEmail: this.contact() ? this.auth.user()?.email : undefined });
      this.sent.set(true);
      void this.achievements.track('feedback_sent');
      this.platform.success();
    } catch {
      await this.toast.show('Could not send feedback. Please try again.', 'error');
    } finally {
      this.busy.set(false);
    }
  }
}
