import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular/standalone';
import { PlatformService } from '../../core/services/platform.service';
import { ChatService } from '../../core/services/chat.service';

interface TabDef {
  id: string;
  label: string;
  icon: string;
  iconActive: string;
}

@Component({
  selector: 'gm-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  template: `
    <ion-tabs (ionTabsDidChange)="changed($event.tab)">
      <ion-tab-bar slot="bottom" class="gm-tabbar" [style.--index]="index()">
        <div class="indicator" [class.moving]="moving()" aria-hidden="true"></div>
        @for (t of tabs; track t.id) {
          <ion-tab-button [tab]="t.id" [class.active]="active() === t.id">
            <span class="icon-wrap">
              <ion-icon [name]="active() === t.id ? t.iconActive : t.icon" />
              @if (t.id === 'chat' && unread() > 0) {
                <span class="dot">{{ unread() }}</span>
              }
            </span>
            <ion-label>{{ t.label }}</ion-label>
          </ion-tab-button>
        }
      </ion-tab-bar>
    </ion-tabs>
  `,
  styleUrl: './tabs.page.scss',
})
export class TabsPage {
  private platform = inject(PlatformService);
  private chat = inject(ChatService);

  readonly tabs: TabDef[] = [
    { id: 'home', label: 'Home', icon: 'home-outline', iconActive: 'home' },
    { id: 'trips', label: 'Trips', icon: 'ticket-outline', iconActive: 'ticket' },
    { id: 'chat', label: 'Chat', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
    { id: 'airport', label: 'Airport', icon: 'map-outline', iconActive: 'map' },
    { id: 'profile', label: 'Profile', icon: 'person-outline', iconActive: 'person' },
  ];
  readonly active = signal('home');
  readonly index = computed(() => Math.max(0, this.tabs.findIndex((t) => t.id === this.active())));
  readonly unread = computed(() => this.chat.threads().reduce((n, t) => n + (t.muted ? 0 : t.unread), 0));

  readonly moving = signal(false);
  private movingTimer?: ReturnType<typeof setTimeout>;

  changed(tab: string) {
    if (tab !== this.active()) {
      this.platform.selection();
      this.moving.set(false);
      requestAnimationFrame(() => this.moving.set(true));
      clearTimeout(this.movingTimer);
      this.movingTimer = setTimeout(() => this.moving.set(false), 650);
    }
    this.active.set(tab);
  }
}
