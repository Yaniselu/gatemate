import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { GatemateApi } from '../../core/services/api';
import { TravelStore } from '../../core/services/travel.store';
import { ToastService } from '../../core/services/toast.service';
import { PlatformService } from '../../core/services/platform.service';
import { AuthService } from '../../core/services/auth.service';
import { Companion, Flight } from '../../core/models';
import { TranslatePipe } from '../../core/i18n/i18n.service';

const SEAT = /^\d{1,3}[A-K]$/;

@Component({
  selector: 'gm-flight-passengers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonIcon, FormsModule, RouterLink],
  template: `
    <div class="who" role="tablist" [attr.aria-label]="'Passengers' | t">
      @if (flight().ownerFlying !== false) {
        <button role="tab" [class.on]="current() === 'me'" (click)="pick('me')">
          <span class="av me">{{ initials(flight().passengerName) }}@if (flight().barcode) { <ion-icon name="qr-code" class="qr" /> }</span>
          <span class="nm">{{ 'You' | t }}@if (flight().seat) { <i>{{ flight().seat }}</i> }</span>
        </button>
      }
      @for (p of flight().passengers ?? []; track p.companionId) {
        <button role="tab" [class.on]="current() === p.companionId" (click)="pick(p.companionId)">
          <span class="av">{{ initials(p.name) }}@if (p.barcode) { <ion-icon name="qr-code" class="qr" /> } @else if (p.verified) { <ion-icon name="shield-checkmark" class="ok" /> }</span>
          <span class="nm">{{ p.name.split(' ')[0] }}@if (p.seat) { <i>{{ p.seat }}</i> }</span>
          @if (current() === p.companionId && editable()) {
            <span class="rm" role="button" tabindex="0" (click)="$event.stopPropagation(); remove(p.companionId)" [attr.aria-label]="'Remove from this flight' | t"><ion-icon name="close" /></span>
          }
        </button>
      }
      @if (editable()) {
        <button class="add" (click)="toggle()" [attr.aria-expanded]="open()"><span class="av"><ion-icon name="person-add-outline" /></span><span class="nm">{{ 'Family' | t }}</span></button>
      }
    </div>

    @if (open()) {
      <div class="picker card anim-fade-up">
        @if (available().length) {
          <span class="gm-label">{{ 'Add to this ticket' | t }}</span>
          @for (c of available(); track c.id) {
            <div class="row">
              <span class="av sm">{{ initials(c.firstName + ' ' + c.lastName) }}</span>
              <span class="who-name">{{ c.firstName }} {{ c.lastName }}</span>
              <input [(ngModel)]="seats[c.id]" [placeholder]="'Seat' | t" maxlength="4" (input)="upper(c.id, $event)" [attr.aria-label]="'Seat' | t" />
              <button class="go" (click)="add(c)" [disabled]="busy() || (!!seats[c.id] && !valid(seats[c.id]))" [attr.aria-label]="'Add' | t"><ion-icon name="add" /></button>
            </div>
          }
        } @else if (loaded()) {
          <p class="empty">{{ companions().length ? ('Everyone in your family is already on this ticket.' | t) : ('Add your family once, then put them on any ticket.' | t) }}</p>
        }
        <p class="scan-hint">{{ 'Have their boarding passes? Scan them and the real barcodes are saved here too.' | t }}</p>
        <a class="scan" routerLink="/add-flight"><ion-icon name="scan-outline" />{{ 'Scan a family member’s boarding pass' | t }}</a>
        <a class="manage" routerLink="/family"><ion-icon name="people-outline" />{{ 'Manage family' | t }}</a>
      </div>
    }
  `,
  styles: `
    :host { display: block; margin-bottom: 12px; }
    .who { display: flex; gap: 8px; overflow-x: auto; overflow-y: hidden; overscroll-behavior-x: contain; scrollbar-width: none; padding: 2px 2px 4px; }
    .who::-webkit-scrollbar { display: none; }
    .who > button { position: relative; flex: none; display: flex; align-items: center; gap: 8px; padding: 6px 12px 6px 6px; border-radius: 999px;
      background: var(--gm-card-bg); border: 1px solid var(--gm-card-border); color: var(--gm-ink); font-weight: 700; font-size: 14px; }
    .who > button.on { border-color: transparent; background: var(--gm-on-accent-bg); color: #fff; }
    .who > button.add { border-style: dashed; color: var(--gm-accent-strong); }
    .av { position: relative; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 800; color: #fff;
      background: linear-gradient(135deg, #8b5cf6, #ec4899); }
    .av.me { background: linear-gradient(135deg, #0fa8b6, #2f86e6); }
    .add .av { background: var(--gm-surface); color: var(--gm-accent-strong); font-size: 16px; }
    .av.sm { width: 28px; height: 28px; flex: none; }
    .av .ok { position: absolute; right: -4px; bottom: -3px; font-size: 14px; color: #16a34a; background: #fff; border-radius: 50%; }
    .av .qr { position: absolute; right: -5px; bottom: -4px; font-size: 13px; padding: 1px; color: #0b1b2b; background: #fff; border-radius: 4px; }
    .scan-hint { margin: 0; font-size: 13px; color: var(--gm-ink-3); }
    .scan { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; font-size: 14px; color: var(--gm-accent-strong); text-decoration: none; }
    .nm { display: inline-flex; align-items: baseline; gap: 6px; white-space: nowrap; }
    .nm i { font-style: normal; font-weight: 800; font-size: 12px; opacity: .75; }
    .rm { display: grid; place-items: center; width: 22px; height: 22px; margin-left: 2px; border-radius: 50%; background: rgba(255,255,255,.22); font-size: 14px; }
    .picker { margin-top: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
    .row { display: flex; align-items: center; gap: 8px; }
    .who-name { flex: 1; min-width: 0; font-weight: 700; font-size: 14.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .row input { width: 64px; padding: 8px; border-radius: 10px; border: 1px solid var(--gm-card-border); background: var(--gm-surface); color: var(--gm-ink);
      font-size: 16px; font-weight: 700; text-align: center; text-transform: uppercase; }
    .go { width: 36px; height: 36px; flex: none; border-radius: 11px; display: grid; place-items: center; font-size: 20px; color: #fff; background: var(--gm-on-accent-bg); }
    .go:disabled { opacity: .4; }
    .empty { margin: 0; font-size: 14px; color: var(--gm-ink-2); }
    .manage { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; font-size: 14px; color: var(--gm-accent-strong); text-decoration: none; }
  `,
})
export class FlightPassengersComponent {
  private api = inject(GatemateApi);
  private store = inject(TravelStore);
  private toast = inject(ToastService);
  private platform = inject(PlatformService);
  private auth = inject(AuthService);
  readonly flight = input.required<Flight>();
  readonly editable = input(true);
  readonly selected = model<string>('me');
  readonly current = computed(() => {
    const f = this.flight(), sel = this.selected();
    const ids = [...(f.ownerFlying !== false ? ['me'] : []), ...(f.passengers ?? []).map((p) => p.companionId)];
    return ids.includes(sel) ? sel : ids[0] ?? 'me';
  });

  readonly open = signal(false);
  readonly busy = signal(false);
  readonly loaded = signal(false);
  readonly companions = signal<Companion[]>([]);
  readonly available = computed(() => {
    const on = new Set((this.flight().passengers ?? []).map((p) => p.companionId));
    return this.companions().filter((c) => !on.has(c.id));
  });
  seats: Record<string, string> = {};

  pick(key: string) {
    this.platform.selection();
    this.selected.set(key);
  }

  async toggle() {
    this.platform.tap();
    this.open.update((v) => !v);
    if (this.open() && !this.loaded()) {
      try {
        this.companions.set(await this.api.getCompanions());
      } catch {
        void this.toast.show('Couldn’t load your family. Check your connection.', 'error');
      } finally {
        this.loaded.set(true);
      }
    }
  }

  valid(seat: string) {
    return SEAT.test(seat);
  }

  upper(id: string, ev: Event) {
    const el = ev.target as HTMLInputElement;
    this.seats[id] = el.value.toUpperCase().replace(/[^0-9A-K]/g, '').slice(0, 4);
    el.value = this.seats[id];
  }

  async add(c: Companion) {
    const seat = this.seats[c.id]?.trim();
    this.busy.set(true);
    try {
      const f = await this.api.addPassenger(this.flight().id, c.id, seat || undefined);
      this.store.replaceFlight(f);
      this.platform.impact();
      this.selected.set(c.id);
      if (!this.available().length) this.open.set(false);
    } catch (e) {
      void this.toast.show(e instanceof Error ? e.message : 'Couldn’t add them to this flight.', 'error');
    } finally {
      this.busy.set(false);
    }
  }

  async remove(id: string) {
    try {
      const f = await this.api.removePassenger(this.flight().id, id);
      this.store.replaceFlight(f);
      this.selected.set('me');
    } catch {
      void this.toast.show('Couldn’t update this flight. Try again.', 'error');
    }
  }

  initials(name: string) {
    const parts = (name || this.auth.user()?.name || '?').trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
}
