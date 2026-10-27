import { ChangeDetectionStrategy, Component, computed, inject, output, signal, OnInit } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { AirportDbService, AirportRecord } from '../../core/services/airport-db.service';
import { LocationService } from '../../core/services/location.service';
import { PlatformService } from '../../core/services/platform.service';

/** Full-screen glass sheet to search ~5,300 airports by code, city, name or country. */
@Component({
  selector: 'gm-airport-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon],
  template: `
    <div class="backdrop" (click)="closed.emit()"></div>
    <div class="sheet glass strong" role="dialog" aria-label="Choose an airport">
      <div class="grab"></div>
      <div class="search">
        <ion-icon name="search-outline" />
        <input #q type="search" placeholder="City, airport or code (e.g. OTP)" [value]="query()" (input)="query.set(q.value)" maxlength="60" autofocus aria-label="Search airports" />
        <button (click)="closed.emit()">Cancel</button>
      </div>
      <button class="near" (click)="nearMe()" [disabled]="locating()">
        <ion-icon name="navigate" /> {{ locating() ? 'Finding the nearest airport…' : 'Airport nearest to me' }}
      </button>
      <div class="list">
        @if (!db.ready()) {
          <p class="muted">Loading 5,300 airports…</p>
        }
        @for (a of results(); track a.iata; let i = $index) {
          <button class="row" (click)="pick(a)" [style.--i]="i">
            <span class="code">{{ a.iata }}</span>
            <span class="txt"><b>{{ a.city || a.name }}</b><small>{{ a.name }} · {{ db.countryName(a.country) }}</small></span>
          </button>
        } @empty {
          @if (db.ready()) { <p class="muted">No airports match “{{ query() }}”.</p> }
        }
      </div>
    </div>
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 2000; display: flex; flex-direction: column; justify-content: flex-end; }
    .backdrop { position: absolute; inset: 0; background: rgba(11,27,43,.28); animation: gm-fade-in .25s; }
    .sheet { position: relative; height: 88%; border-radius: 28px 28px 0 0 !important; padding: 8px 14px 0; display: flex; flex-direction: column; animation: up .45s var(--gm-ease-spring); }
    @keyframes up { from { transform: translateY(100%); } }
    .grab { width: 40px; height: 5px; border-radius: 3px; background: rgba(11,27,43,.18); margin: 0 auto 10px; }
    .search { display: flex; align-items: center; gap: 8px; height: 46px; padding: 0 0 0 12px; border-radius: 14px; background: rgba(255,255,255,.75); border: 1px solid rgba(11,27,43,.06); }
    .search ion-icon { color: var(--gm-ink-3); }
    .search input { flex: 1; min-width: 0; border: 0; outline: none; background: none; font-size: 16px; }
    .search button { background: none; color: var(--gm-accent-strong); font-weight: 650; padding: 0 12px; }
    .near { display: flex; align-items: center; gap: 8px; margin: 10px 2px; background: none; color: #2f80ff; font-weight: 650; font-size: 14.5px; }
    .list { flex: 1; overflow-y: auto; padding-bottom: calc(20px + env(safe-area-inset-bottom)); }
    .row { display: flex; align-items: center; gap: 12px; width: 100%; padding: 11px 2px; background: none; text-align: left; border-bottom: 1px solid var(--gm-line); color: var(--gm-ink); animation: gm-fade-up .3s var(--gm-ease-out) both; animation-delay: calc(min(var(--i), 12) * 18ms); }
    .code { flex: none; width: 50px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; letter-spacing: .04em; color: #fff; background: var(--gm-navy); }
    .txt { min-width: 0; }
    .txt b { display: block; font-size: 15px; }
    .txt small { display: block; color: var(--gm-ink-3); font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .muted { color: var(--gm-ink-3); text-align: center; padding: 20px; }
  `,
})
export class AirportPickerComponent implements OnInit {
  protected db = inject(AirportDbService);
  private location = inject(LocationService);
  private platform = inject(PlatformService);
  readonly picked = output<AirportRecord>();
  readonly closed = output<void>();
  readonly query = signal('');
  readonly locating = signal(false);
  readonly results = computed(() => (this.db.ready() ? this.db.search(this.query(), 40) : []));

  ngOnInit() {
    void this.db.load();
  }

  pick(a: AirportRecord) {
    this.platform.selection();
    this.picked.emit(a);
  }

  async nearMe() {
    this.locating.set(true);
    const f = await this.location.locate();
    await this.db.load();
    this.locating.set(false);
    const n = f ? this.db.nearest(f.lat, f.lon) : null;
    if (n) this.pick(n.airport);
  }
}
