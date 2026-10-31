import { AfterViewInit, ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonToolbar } from '@ionic/angular/standalone';
import { AirportDbService, AirportRecord } from '../../core/services/airport-db.service';
import { TravelStore } from '../../core/services/travel.store';
import { PlatformService } from '../../core/services/platform.service';
import { AIRPORT_RULES } from '../airport-rules/airport-rules.data';
import { t as tr, TranslatePipe } from '../../core/i18n/i18n.service';
import { FEATURES, POPULAR, score, SearchEntry } from './search.index';

interface Hit {
  title: string;
  sub: string;
  icon: string;
  color: string;
  route: string;
  params?: Record<string, string>;
  score: number;
}

const RECENT_KEY = 'gm_recent_search';

@Component({
  selector: 'gm-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, FormsModule, IonContent, IonHeader, IonToolbar, IonButtons, IonBackButton, IonIcon],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/home" text="" icon="chevron-back" /></ion-buttons>
        <div class="bar">
          <ion-icon name="search-outline" />
          <input #box type="search" [ngModel]="q()" (ngModelChange)="q.set($event)" [placeholder]="'Search Gatemate' | t" enterkeyhint="search"
                 autocomplete="off" autocorrect="off" spellcheck="false" (keydown.enter)="openFirst()" [attr.aria-label]="'Search Gatemate' | t" />
          @if (q()) { <button class="clear" (click)="q.set(''); box.focus()" [attr.aria-label]="'Clear' | t"><ion-icon name="close-circle" /></button> }
        </div>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <div class="page">
        @if (!q().trim()) {
          @if (recent().length) {
            <span class="gm-label">{{ 'Recent' | t }}</span>
            <div class="chips">
              @for (r of recent(); track r) { <button (click)="q.set(r)"><ion-icon name="time-outline" />{{ r }}</button> }
            </div>
          }
          <span class="gm-label">{{ 'Popular' | t }}</span>
          <div class="chips">
            @for (p of popular; track p) { <button (click)="pickPopular(p)">{{ p | t }}</button> }
          </div>
          <span class="gm-label">{{ 'Everything in Gatemate' | t }}</span>
          <div class="list">
            @for (f of features; track f.title + f.route) {
              <button class="hit" (click)="go(f)">
                <span class="ic" [style.--c]="f.color"><ion-icon [name]="f.icon" /></span>
                <span class="txt"><b>{{ f.title | t }}</b><small>{{ f.sub | t }}</small></span>
                <ion-icon name="chevron-forward" class="chev" />
              </button>
            }
          </div>
        } @else if (total() === 0) {
          <div class="none">
            <ion-icon name="search-outline" />
            <b>{{ 'Nothing found for “{q}”' | t: { q: q().trim() } }}</b>
            <p>{{ 'Try another word, or ask Velo.' | t }}</p>
            <button class="gm-btn" (click)="askVelo()"><ion-icon name="sparkles-outline" />{{ 'Ask Velo' | t }}</button>
          </div>
        } @else {
          @for (g of groups(); track g.label) {
            @if (g.hits.length) {
              <span class="gm-label">{{ g.label | t }}</span>
              <div class="list">
                @for (h of g.hits; track h.title + h.route + (h.params?.['q'] ?? '')) {
                  <button class="hit" (click)="go(h)">
                    <span class="ic" [style.--c]="h.color"><ion-icon [name]="h.icon" /></span>
                    <span class="txt"><b>{{ h.title }}</b><small>{{ h.sub }}</small></span>
                    <ion-icon name="chevron-forward" class="chev" />
                  </button>
                }
              </div>
            }
          }
          <button class="velo" (click)="askVelo()"><ion-icon name="sparkles-outline" />{{ 'Ask Velo about “{q}”' | t: { q: q().trim() } }}</button>
        }
      </div>
    </ion-content>
  `,
  styles: `
    ion-toolbar { --padding-end: 12px; }
    .bar { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 10px 0 12px; border-radius: 12px; background: var(--gm-surface); color: var(--gm-ink-3); }
    .bar input { flex: 1; min-width: 0; height: 100%; border: 0; outline: none; background: none; color: var(--gm-ink); font-size: 16px; }
    .bar input::-webkit-search-cancel-button { display: none; }
    .clear { display: grid; place-items: center; font-size: 18px; color: var(--gm-ink-3); background: none; }
    .page { padding: 10px 16px 40px; display: flex; flex-direction: column; gap: 10px; }
    .gm-label { margin-top: 6px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chips button { display: inline-flex; align-items: center; gap: 5px; padding: 8px 12px; border-radius: 999px; font-size: 14px; font-weight: 650;
      color: var(--gm-ink-2); background: var(--gm-card-bg); border: 1px solid var(--gm-card-border); }
    .list { display: flex; flex-direction: column; border-radius: 18px; overflow: hidden; background: var(--gm-card-bg); border: 1px solid var(--gm-card-border); }
    .hit { display: flex; align-items: center; gap: 12px; padding: 11px 12px; text-align: left; background: none; color: var(--gm-ink); border-bottom: 1px solid var(--gm-line); }
    .hit:last-child { border-bottom: 0; }
    .ic { width: 36px; height: 36px; flex: none; border-radius: 11px; display: grid; place-items: center; font-size: 19px; color: var(--c);
      background: color-mix(in srgb, var(--c) 15%, transparent); }
    .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .txt b { font-size: 15px; font-weight: 750; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .txt small { font-size: 12.5px; color: var(--gm-ink-3); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .chev { color: var(--gm-ink-3); font-size: 16px; }
    .none { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 10px; text-align: center; }
    .none > ion-icon { font-size: 40px; color: var(--gm-ink-3); }
    .none b { font-size: 17px; }
    .none p { margin: 0 0 6px; color: var(--gm-ink-2); }
    .velo { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 12px; margin-top: 4px; border-radius: 14px; font-weight: 750;
      color: var(--gm-violet, #8b5cf6); background: color-mix(in srgb, #8b5cf6 12%, transparent); }
  `,
})
export class SearchPage implements AfterViewInit {
  private router = inject(Router);
  private db = inject(AirportDbService);
  private store = inject(TravelStore);
  private platform = inject(PlatformService);
  private box = viewChild<ElementRef<HTMLInputElement>>('box');

  readonly features = FEATURES;
  readonly popular = POPULAR;
  readonly q = signal('');
  readonly recent = signal<string[]>(readRecent());
  private dbReady = signal(false);

  constructor() {
    void this.db.load().then(() => this.dbReady.set(true));
    void this.store.loadTrips().catch(() => {});
  }

  ngAfterViewInit() {
    setTimeout(() => this.box()?.nativeElement.focus(), 350);
  }

  readonly groups = computed(() => {
    const q = this.q().trim();
    if (!q) return [];
    const top = (list: Hit[], n: number): Hit[] => list.filter((h) => h.score > 0).sort((a, b) => b.score - a.score).slice(0, n);

    const features = top(FEATURES.map((f) => ({ ...f, title: tr(f.title), sub: tr(f.sub), score: score(q, tr(f.title) + ' ' + f.title, tr(f.sub) + ' ' + f.sub + ' ' + f.keys) })), 8);

    const trips = top(
      this.store.trips().map((t) => {
        const flights = t.flights.map((f) => `${f.number} ${f.from.code} ${f.to.code} ${f.from.city} ${f.to.city} ${f.bookingRef ?? ''}`).join(' ');
        return { title: t.title, sub: t.flights.map((f) => `${f.number} · ${f.from.code} → ${f.to.code}`).join(' · '), icon: 'airplane', color: '#0FB5C3', route: `/trip/${t.id}`, score: score(q, t.title, `${t.destination.city} ${t.destination.country} ${flights}`) };
      }),
      5,
    );

    let airports: Hit[] = [];
    if (this.dbReady() && q.length >= 2) {
      airports = this.db.search(q, 5).flatMap((a: AirportRecord) => [
        { title: `${a.city} · ${a.iata}`, sub: `${a.name} · ${tr('Airport map')}`, icon: 'map-outline', color: '#10B981', route: `/airport-map/${a.iata}`, score: 3 },
        { title: tr('{city} city guide', { city: a.city }), sub: tr('Sights, travel plan, money, phrases'), icon: 'compass-outline', color: '#0EA5E9', route: `/explore/${a.iata}`, score: 2 },
      ]).slice(0, 6);
    }

    const rules = top(
      AIRPORT_RULES.map((r) => ({ title: tr(r.title), sub: tr(r.body), icon: r.kind === 'must' ? 'alert-circle-outline' : 'bulb-outline', color: '#3B82F6', route: '/airport-rules', params: { q: tr(r.title) }, score: score(q, tr(r.title) + ' ' + r.title, tr(r.body) + ' ' + r.body) })),
      5,
    );

    return [
      { label: 'Features', hits: features },
      { label: 'Your trips', hits: trips },
      { label: 'Airport rules', hits: rules },
      { label: 'Airports', hits: airports },
    ];
  });
  readonly total = computed(() => this.groups().reduce((n, g) => n + g.hits.length, 0));

  go(h: Pick<SearchEntry, 'route' | 'params'>) {
    this.platform.selection();
    this.remember();
    void this.router.navigate([h.route], h.params ? { queryParams: h.params } : {});
  }

  pickPopular(p: string) {
    this.q.set(tr(p));
  }

  openFirst() {
    const first = this.groups().find((g) => g.hits.length)?.hits[0];
    if (first) this.go(first);
  }

  askVelo() {
    this.remember();
    void this.router.navigate(['/assistant'], { queryParams: { prompt: this.q().trim() } });
  }

  private remember() {
    const q = this.q().trim();
    if (q.length < 2) return;
    const list = [q, ...this.recent().filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 6);
    this.recent.set(list);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch {
      return;
    }
  }
}

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 6) : [];
  } catch {
    return [];
  }
}
