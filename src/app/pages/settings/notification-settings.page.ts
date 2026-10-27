import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToggle, IonToolbar } from '@ionic/angular/standalone';
import { PrefsService } from '../../core/services/prefs.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { PlatformService } from '../../core/services/platform.service';
import { NotificationPrefs } from '../../core/models';
import { RevealDirective } from '../../shared/directives/reveal.directive';

@Component({
  selector: 'gm-notification-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, IonToggle, RevealDirective],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/profile" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>Notifications</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <div class="page">
        <div class="bell anim-scale-in"><ion-icon name="notifications" /></div>
        <p class="lead">Choose what Gatemate tells you about. Critical flight alerts are sent even when the app is closed.</p>
        <div class="group glass flat">
          @for (o of options; track o.key; let i = $index) {
            <div class="row" [gmReveal]="i">
              <span class="ic" [style.--c]="o.color"><ion-icon [name]="o.icon" /></span>
              <div class="grow"><b>{{ o.label }}</b><small>{{ o.hint }}</small></div>
              <ion-toggle [checked]="prefs.notifications()[o.key]" (ionChange)="set(o.key, $event.detail.checked)" [attr.aria-label]="o.label" />
            </div>
          }
        </div>
        @if (platform.isNative) {
          <button class="gm-btn ghost" (click)="notifications.requestPermission()"><ion-icon name="notifications-outline" /> Allow notifications</button>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .page { padding: 8px 18px 40px; }
    .bell { width: 76px; height: 76px; margin: 10px auto 14px; border-radius: 26px; display: flex; align-items: center; justify-content: center; font-size: 36px; color: #fff; background: linear-gradient(135deg,#22c7d3,#0a93a6); box-shadow: 0 14px 30px var(--gm-accent-glow); }
    .bell ion-icon { animation: ring 2.6s ease-in-out infinite; transform-origin: 50% 10%; }
    @keyframes ring { 0%, 60%, 100% { transform: rotate(0); } 10%, 30% { transform: rotate(14deg); } 20%, 40% { transform: rotate(-14deg); } 50% { transform: rotate(6deg); } }
    .lead { text-align: center; color: var(--gm-ink-3); margin: 0 10px 20px; line-height: 1.45; }
    .group { border-radius: 22px; overflow: hidden; margin-bottom: 16px; }
    .row { display: flex; align-items: center; gap: 12px; padding: 13px 14px; border-bottom: 1px solid var(--gm-line); }
    .row:last-child { border-bottom: 0; }
    .ic { flex: none; width: 36px; height: 36px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #fff; background: var(--c); font-size: 18px; }
    .grow { flex: 1; min-width: 0; }
    .grow b { display: block; font-size: 15px; }
    .grow small { display: block; margin-top: 2px; line-height: 1.35; color: var(--gm-ink-3); font-size: 12.5px; }
    ion-toggle { --track-background-checked: var(--gm-accent); }
  `,
})
export class NotificationSettingsPage {
  protected prefs = inject(PrefsService);
  protected notifications = inject(NotificationsService);
  protected platform = inject(PlatformService);

  readonly options: { key: keyof NotificationPrefs; label: string; hint: string; icon: string; color: string }[] = [
    { key: 'boarding', label: 'Boarding calls', hint: '15 min before and when boarding starts', icon: 'airplane', color: '#0FB5C3' },
    { key: 'gateChanges', label: 'Gate changes', hint: 'Instantly, with walking time', icon: 'navigate-outline', color: '#8B7CF6' },
    { key: 'delays', label: 'Delays & cancellations', hint: 'Including your passenger rights', icon: 'time-outline', color: '#FFB020' },
    { key: 'checkIn', label: 'Check-in reminders', hint: '24 h before departure', icon: 'checkmark-circle', color: '#2FD18A' },
    { key: 'baggage', label: 'Baggage belt', hint: 'When you land', icon: 'bag-handle-outline', color: '#FF8A5B' },
    { key: 'chat', label: 'Chat messages', hint: 'From your trip groups', icon: 'chatbubbles-outline', color: '#5EC8FF' },
    { key: 'tips', label: 'Travel tips', hint: 'Occasional, never marketing', icon: 'sparkles', color: '#74859A' },
  ];

  set(key: keyof NotificationPrefs, value: boolean) {
    this.platform.selection();
    void this.prefs.setNotifications({ ...this.prefs.notifications(), [key]: value });
  }
}
