import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { InviteService } from '../../core/services/invite.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';

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
  `,
})
export class InvitePanelComponent implements OnInit {
  protected invites = inject(InviteService);
  readonly targetId = input.required<string>();
  readonly title = input.required<string>();
  readonly url = signal<string | null>(null);

  async ngOnInit() {
    this.url.set(await this.invites.link(this.targetId()));
  }
}
