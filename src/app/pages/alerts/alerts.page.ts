import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { RouterLink } from '@angular/router';
import { TravelStore } from '../../core/services/travel.store';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { RelativeTimePipe } from '../../shared/pipes/time.pipes';
import { ALERT_ICONS } from '../home/home.page';

@Component({
  selector: 'gm-alerts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, RouterLink, SkeletonComponent, RevealDirective, RelativeTimePipe],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/home" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>Alerts</ion-title>
        <ion-buttons slot="end">
          @if (store.unreadAlerts() > 0) {
            <button class="mark" (click)="store.markAllAlertsRead()">Mark all read</button>
          }
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <div class="page">
        @if (store.alertsState() !== 'ready') {
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="alert"><gm-skeleton width="44px" height="44px" radius="15px" /><div class="grow"><gm-skeleton width="60%" height="14px" /><gm-skeleton height="12px" style="margin-top: 8px" /></div></div>
          }
        } @else {
          @for (a of store.alerts(); track a.id; let i = $index) {
            <div class="alert" [gmReveal]="i" [class.unread]="!a.read">
              <span class="ic" [style.--c]="icons[a.kind].color"><ion-icon [name]="icons[a.kind].icon" /></span>
              <div class="grow">
                <div class="t">{{ a.title }}</div>
                <div class="b">{{ a.body }}</div>
                <time>{{ a.createdAt | relTime }}</time>
              </div>
            </div>
          } @empty {
            <div class="gm-empty"><ion-icon name="notifications-outline" /><h3>All caught up</h3><p>Gate changes, delays and boarding calls will appear here.</p></div>
          }
          <a class="settings glass flat" routerLink="/settings/notifications">
            <ion-icon name="settings-outline" /> Choose which alerts you get <ion-icon name="chevron-forward" class="chev" />
          </a>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .page { padding: 8px 18px 40px; }
    .mark { background: none; color: var(--gm-accent-strong); font-weight: 650; font-size: 15px; margin-right: 10px; }
    .alert { position: relative; display: flex; gap: 12px; padding: 14px 4px; border-bottom: 1px solid var(--gm-line); }
    .alert.unread::after { content: ''; position: absolute; right: 4px; top: 20px; width: 9px; height: 9px; border-radius: 50%; background: var(--gm-accent); animation: gm-pop .5s var(--gm-ease-spring); }
    .ic { flex: none; width: 44px; height: 44px; border-radius: 15px; display: flex; align-items: center; justify-content: center; font-size: 21px; color: var(--c); background: color-mix(in srgb, var(--c) 13%, white); }
    .grow { flex: 1; min-width: 0; padding-right: 14px; }
    .t { font-weight: 700; font-size: 15.5px; }
    .b { color: var(--gm-ink-2); font-size: 14px; margin-top: 3px; line-height: 1.4; }
    time { display: block; margin-top: 5px; font-size: 12px; color: var(--gm-ink-3); }
    .settings { display: flex; align-items: center; gap: 10px; padding: 16px; margin-top: 20px; border-radius: 18px; color: var(--gm-ink); text-decoration: none; font-weight: 600; }
    .settings ion-icon { color: var(--gm-accent-strong); font-size: 20px; }
    .settings .chev { margin-left: auto; color: #b6c2cf; }
  `,
})
export class AlertsPage implements OnInit {
  protected store = inject(TravelStore);
  protected icons = ALERT_ICONS;

  ngOnInit(): void {
    void this.store.loadAlerts().then(() => setTimeout(() => this.store.markAllAlertsRead(), 2500));
  }
}
