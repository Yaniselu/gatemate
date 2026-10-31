import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { GatemateApi } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { IonIcon } from '@ionic/angular/standalone';
import { InviteService } from '../../core/services/invite.service';
import { t as tr, TranslatePipe } from '../../core/i18n/i18n.service';

@Component({
  selector: 'gm-invite-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonIcon],
  template: `
    <button class="wa" (click)="url() && invites.whatsapp(title(), url()!)" [disabled]="!url()">
      <ion-icon name="logo-whatsapp" /> {{ 'Invite via WhatsApp' | t }}
    </button>
    <div class="row">
      <button class="alt card" (click)="url() && invites.share(title(), url()!)" [disabled]="!url()"><ion-icon name="share-outline" /> {{ 'More apps' | t }}</button>
      <button class="alt card" (click)="url() && invites.copy(url()!)" [disabled]="!url()"><ion-icon name="link-outline" /> {{ 'Copy link' | t }}</button>
    </div>
    @if (byEmail()) {
      <form class="mail card" (submit)="$event.preventDefault(); sendMail()">
        <ion-icon name="mail-outline" />
        <input type="email" [value]="email()" (input)="email.set($any($event.target).value)" [placeholder]="'Invite by e-mail' | t" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" maxlength="254" [attr.aria-label]="'Invite by e-mail' | t" />
        <button type="submit" [disabled]="!valid() || sending()">{{ sending() ? ('Sending…' | t) : ('Send' | t) }}</button>
      </form>
    }
    <p class="fine"><ion-icon name="lock-closed-outline" /> {{ 'Link works once, expires in 7 days, and friends must sign in to join.' | t }}</p>
  `,
  styles: `
    :host { display: block; }
    .wa { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; height: 56px; border-radius: 18px; background: #25d366; color: #fff; font-size: 17px; font-weight: 750; box-shadow: 0 12px 26px rgba(37,211,102,.32); transition: transform .2s var(--gm-ease-spring); }
    .wa:active { transform: scale(.97); }
    .wa ion-icon { font-size: 24px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
    .alt { display: flex; align-items: center; justify-content: center; gap: 8px; height: 48px; font-weight: 650; color: var(--gm-ink); }
    .fine { display: flex; align-items: center; gap: 6px; justify-content: center; font-size: 12px; color: var(--gm-ink-3); margin: 12px 0 0; }
    button[disabled] { opacity: .6; }
    .mail { display: flex; align-items: center; gap: 8px; margin-top: 10px; padding: 6px 6px 6px 14px; }
    .mail ion-icon { flex: none; font-size: 19px; color: var(--gm-ink-3); }
    .mail input { flex: 1; min-width: 0; height: 40px; border: 0; outline: none; background: none; color: var(--gm-ink); font-size: 16px; }
    .mail button { flex: none; height: 40px; padding: 0 16px; border-radius: 12px; font-weight: 750; color: #fff; background: var(--gm-on-accent-bg); }
  `,
})
export class InvitePanelComponent implements OnInit {
  protected invites = inject(InviteService);
  readonly targetId = input.required<string>();
  readonly title = input.required<string>();
  readonly url = signal<string | null>(null);
  readonly byEmail = input(false);
  readonly email = signal('');
  readonly sending = signal(false);
  readonly valid = computed(() => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(this.email().trim()));
  private api = inject(GatemateApi);
  private toast = inject(ToastService);

  async sendMail() {
    const to = this.email().trim();
    if (!this.valid()) return;
    this.sending.set(true);
    try {
      const res = await this.api.inviteByEmail(this.targetId(), to);
      if (res.sent) {
        void this.toast.show(tr('Invitation sent to {email}', { email: to }), 'success');
      } else {
        const subject = tr('Join my trip “{trip}” on Gatemate', { trip: this.title() });
        const body = tr('Join my trip on Gatemate: {url}', { url: res.url });
        window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }
      this.email.set('');
    } catch (e) {
      void this.toast.show(e instanceof Error ? e.message : 'Couldn’t send the invitation.', 'error');
    } finally {
      this.sending.set(false);
    }
  }

  async ngOnInit() {
    this.url.set(await this.invites.link(this.targetId()));
  }
}
