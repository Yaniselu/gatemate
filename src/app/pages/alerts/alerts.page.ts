import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { RouterLink } from '@angular/router';
import { TravelStore } from '../../core/services/travel.store';
import { PlatformService } from '../../core/services/platform.service';
import { FlightAlert } from '../../core/models';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { RelativeTimePipe } from '../../shared/pipes/time.pipes';
import { ALERT_ICONS } from '../home/home.page';
import { locale, TranslatePipe } from '../../core/i18n/i18n.service';

type Filter = 'all' | 'flights' | 'prep' | 'social';
const GROUP: Record<string, Filter> = {
  boarding: 'flights', gate: 'flights', delay: 'flights', checkin: 'flights', leave: 'flights', baggage: 'flights',
  documents: 'prep', bags: 'prep', checklist: 'prep', weather: 'prep', info: 'prep', chat: 'social',
};

@Component({
  selector: 'gm-alerts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, RouterLink, SkeletonComponent, RevealDirective, RelativeTimePipe],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/home" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>{{ 'Alerts' | t }}</ion-title>
        <ion-buttons slot="end">
          @if (store.unreadAlerts() > 0) {
            <button class="mark" (click)="markAll()" [attr.aria-label]="'Mark all read' | t" [title]="'Mark all read' | t"><ion-icon name="checkmark-done" /></button>
          }
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <div class="page">
        <div class="filters">
          @for (f of filters; track f.id) {
            <button [class.on]="filter() === f.id" (click)="setFilter(f.id)">{{ f.label | t }} @if (count(f.id)) { <em>{{ count(f.id) }}</em> }</button>
          }
        </div>

        @if (store.alertsState() === 'loading') {
          @for (i of [1, 2, 3]; track i) {
            <div class="alert"><gm-skeleton width="44px" height="44px" radius="14px" /><div class="grow"><gm-skeleton width="60%" height="14px" /><gm-skeleton height="12px" style="margin-top: 8px" /></div></div>
          }
        } @else {
          @if (due().length) {
            <span class="gm-label grp">{{ 'Now & recent' | t }}</span>
            <div class="list card">
              @for (a of due(); track a.id; let i = $index) {
                <div class="alert" [gmReveal]="i" [class.unread]="!a.read" [style.transform]="'translateX(' + offset(a.id) + 'px)'" [class.gone]="leaving() === a.id"
                     (pointerdown)="ds($event, a)" (pointermove)="dm($event, a)" (pointerup)="de(a)" (pointercancel)="de(a)">
                  <span class="gm-well" [style.color]="icons[a.kind].color"><ion-icon [name]="icons[a.kind].icon" /></span>
                  <div class="grow">
                    <div class="t">{{ a.title | t }}</div>
                    <div class="b">{{ a.body | t }}</div>
                    <time>{{ a.createdAt | relTime }}</time>
                  </div>
                </div>
              }
            </div>
            <p class="hint"><ion-icon name="swap-horizontal" /> {{ 'Swipe an alert to clear it' | t }}</p>
          }

          @if (upcoming().length) {
            <span class="gm-label grp">{{ 'Scheduled reminders' | t }}</span>
            <div class="list card">
              @for (a of upcoming(); track a.id; let i = $index) {
                <div class="alert future" [gmReveal]="i">
                  <span class="gm-well"><ion-icon [name]="icons[a.kind].icon" /></span>
                  <div class="grow">
                    <div class="t">{{ a.title | t }}</div>
                    <time><ion-icon name="alarm-outline" /> {{ when(a.createdAt) }}</time>
                  </div>
                </div>
              }
            </div>
          }

          @if (!due().length && !upcoming().length) {
            <div class="gm-empty"><ion-icon name="notifications-outline" /><h3>{{ 'All caught up' | t }}</h3><p>{{ 'Add a booking and Gatemate reminds you about check-in, leaving for the airport and boarding.' | t }}</p></div>
          }
          <a class="settings card" routerLink="/settings/notifications">
            <ion-icon name="settings-outline" /> {{ 'Choose which alerts you get' | t }} <ion-icon name="chevron-forward" class="chev" />
          </a>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .page { padding: 8px 16px 40px; }
    .mark { width: 40px; height: 40px; margin-right: 6px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; color: var(--gm-accent-strong); background: var(--gm-accent-soft); }
    .filters { display: flex; gap: 8px; overflow-x: auto; overflow-y: hidden; overscroll-behavior-x: contain; margin: 4px -16px 14px; padding: 2px 16px; scrollbar-width: none; }
    .filters button { flex: none; padding: 8px 14px; border-radius: 999px; background: var(--gm-surface); font-weight: 650; font-size: 13.5px; color: var(--gm-ink-2); transition: all .3s var(--gm-ease-spring); }
    .filters button.on { background: var(--gm-navy); color: #fff; }
    .filters em { font-style: normal; margin-left: 4px; padding: 1px 6px; border-radius: 8px; background: var(--gm-badge); color: #fff; font-size: 11px; }
    .grp { margin: 10px 4px 8px; }
    .list { padding: 0 14px; overflow: hidden; }
    .alert { position: relative; display: flex; gap: 12px; padding: 13px 0; border-bottom: 1px solid var(--gm-line); background: var(--gm-card-bg); touch-action: pan-y; transition: transform .25s var(--gm-ease-out), opacity .25s, max-height .3s; max-height: 220px; }
    .alert:last-child { border-bottom: 0; }
    .alert.gone { transform: translateX(110%) !important; opacity: 0; max-height: 0; padding: 0; }
    .alert.unread .t::after { content: ''; display: inline-block; width: 7px; height: 7px; margin-left: 6px; border-radius: 50%; background: var(--gm-accent); vertical-align: middle; }
    .alert.future .t { color: var(--gm-ink-2); font-weight: 600; }
    .grow { flex: 1; min-width: 0; }
    .t { font-weight: 700; font-size: 15px; }
    .b { color: var(--gm-ink-2); font-size: 13.5px; margin-top: 3px; line-height: 1.4; }
    time { display: flex; align-items: center; gap: 4px; margin-top: 5px; font-size: 12px; color: var(--gm-ink-3); }
    .hint { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; color: var(--gm-ink-3); margin: 8px 0 4px; }
    .settings { display: flex; align-items: center; gap: 10px; padding: 16px; margin-top: 18px; color: var(--gm-ink); text-decoration: none; font-weight: 600; }
    .settings ion-icon { color: var(--gm-accent-strong); font-size: 20px; }
    .settings .chev { margin-left: auto; color: #b6c2cf; }
  `,
})
export class AlertsPage implements OnInit {
  protected store = inject(TravelStore);
  private platform = inject(PlatformService);
  protected icons = ALERT_ICONS;
  readonly filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' }, { id: 'flights', label: 'Flights' }, { id: 'prep', label: 'Trip prep' }, { id: 'social', label: 'Chats' },
  ];
  readonly filter = signal<Filter>('all');
  readonly drag = signal<Record<string, number>>({});
  readonly leaving = signal<string | null>(null);
  private startX = 0;

  readonly due = computed(() => this.store.dueAlerts().filter((a) => this.filter() === 'all' || GROUP[a.kind] === this.filter()));
  readonly upcoming = computed(() => this.store.upcomingReminders().filter((a) => this.filter() === 'all' || GROUP[a.kind] === this.filter()).slice(0, 12));

  ngOnInit(): void {
    void Promise.all([this.store.loadTrips(), this.store.loadAlerts()]);
  }

  offset(id: string): number {
    return this.drag()[id] || 0;
  }

  count(f: Filter) {
    return this.store.dueAlerts().filter((a) => !a.read && (f === 'all' || GROUP[a.kind] === f)).length;
  }

  setFilter(f: Filter) {
    this.platform.selection();
    this.filter.set(f);
  }

  markAll() {
    this.platform.success();
    void this.store.markAllAlertsRead();
  }

  when(iso: string) {
    return new Date(iso).toLocaleString(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  ds(e: PointerEvent, _a: FlightAlert) {
    this.startX = e.clientX;
  }

  dm(e: PointerEvent, a: FlightAlert) {
    if (!this.startX) return;
    const dx = Math.max(0, e.clientX - this.startX);
    if (dx > 6) this.drag.update((d) => ({ ...d, [a.id]: dx }));
  }

  de(a: FlightAlert) {
    const dx = this.drag()[a.id] ?? 0;
    this.startX = 0;
    if (dx > 110) {
      this.platform.impact();
      this.leaving.set(a.id);
      setTimeout(() => {
        this.store.dismissAlert(a.id);
        this.leaving.set(null);
      }, 280);
    }
    this.drag.update((d) => ({ ...d, [a.id]: 0 }));
  }
}
