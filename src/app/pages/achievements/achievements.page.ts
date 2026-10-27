import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { AchievementsService, BadgeView, LEVELS } from '../../core/services/achievements.service';
import { PlatformService } from '../../core/services/platform.service';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { SheenDirective } from '../../shared/directives/sheen.directive';
import { CountUpDirective } from '../../shared/directives/count-up.directive';

@Component({
  selector: 'gm-achievements',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, RevealDirective, SheenDirective, CountUpDirective],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/profile" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>Achievements</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <div class="page">
        <div class="level glass smoke anim-scale-in" gmSheen="3">
          <div class="lv-top">
            <div class="ring">
              <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" class="bg" /><circle cx="50" cy="50" r="44" class="fg" [style.stroke-dashoffset]="276 - 276 * a.level().progress" /></svg>
              <b>{{ a.level().index }}</b>
            </div>
            <div>
              <span class="gm-label light">Level {{ a.level().index }}</span>
              <h2>{{ a.level().name }}</h2>
              <small>@if (a.level().next) { {{ a.level().toNext }} XP to {{ a.level().next }} } @else { Top level reached ✈️ }</small>
            </div>
          </div>
          <div class="stats">
            <span><b [gmCountUp]="a.xp()"></b><small>XP</small></span>
            <span><b>{{ a.streak() }}🔥</b><small>Day streak</small></span>
            <span><b>{{ a.earnedCount() }}/{{ total }}</b><small>Badges</small></span>
          </div>
          <div class="ladder">
            @for (l of levels; track l.name; let i = $index) { <i [class.on]="i < a.level().index" [title]="l.name"></i> }
          </div>
        </div>

        <div class="filters">
          @for (f of filters; track f.id) { <button [class.on]="filter() === f.id" (click)="setFilter(f.id)">{{ f.label }}</button> }
        </div>

        <div class="grid">
          @for (b of shown(); track b.id; let i = $index) {
            <button class="badge card" [class.earned]="b.earned" [attr.data-tier]="b.tier" [gmReveal]="i" (click)="select(b)">
              <span class="medal">
                <svg viewBox="0 0 64 64" class="prog"><circle cx="32" cy="32" r="29" /><circle cx="32" cy="32" r="29" class="p" [style.stroke-dashoffset]="182 - 182 * b.progress" /></svg>
                <span class="disc"><ion-icon [name]="b.earned ? b.icon : 'lock-closed'" /></span>
              </span>
              <b>{{ b.title }}</b>
              <small>{{ b.earned ? '+' + b.xp + ' XP' : Math.round(b.progress * 100) + '%' }}</small>
            </button>
          }
        </div>

        @if (selected(); as b) {
          <div class="detail-backdrop" (click)="selected.set(null)"></div>
          <div class="detail glass strong" [attr.data-tier]="b.tier">
            <span class="medal big" [class.earned]="b.earned"><span class="disc"><ion-icon [name]="b.earned ? b.icon : 'lock-closed'" /></span></span>
            <h3>{{ b.title }}</h3>
            <p>{{ b.description }}</p>
            <div class="bar"><span [style.transform]="'scaleX(' + b.progress + ')'"></span></div>
            <small>{{ b.earned ? 'Earned ' + date(b.earnedAt) : Math.round(b.progress * 100) + '% · ' + b.xp + ' XP when unlocked' }}</small>
            <button class="gm-btn small" (click)="selected.set(null)">Close</button>
          </div>
        }
        <p class="fine">Badges are earned only through what you do in Gatemate — never bought or random.</p>
      </div>
    </ion-content>
  `,
  styles: `
    .page { padding: 8px 16px 40px; }
    .level { padding: 18px; border-radius: 24px; }
    .gm-label.light { color: rgba(255,255,255,.6); }
    .lv-top { display: flex; gap: 16px; align-items: center; }
    .ring { position: relative; width: 78px; height: 78px; flex: none; }
    .ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .ring circle { fill: none; stroke-width: 8; }
    .ring .bg { stroke: rgba(255,255,255,.15); }
    .ring .fg { stroke: #9cf2f7; stroke-linecap: round; stroke-dasharray: 276; transition: stroke-dashoffset 1.2s var(--gm-ease-out); }
    .ring b { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 850; }
    h2 { color: #fff; margin: 2px 0; font-size: 24px; font-weight: 800; }
    .lv-top small { color: rgba(255,255,255,.7); }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,.12); text-align: center; }
    .stats b { display: block; font-size: 20px; font-variant-numeric: tabular-nums; }
    .stats small { color: rgba(255,255,255,.6); font-size: 11.5px; }
    .ladder { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; margin-top: 14px; }
    .ladder i { height: 4px; border-radius: 2px; background: rgba(255,255,255,.15); }
    .ladder i.on { background: linear-gradient(90deg, #22c7d3, #9cf2f7); }
    .filters { display: flex; gap: 8px; margin: 18px 0 12px; }
    .filters button { padding: 8px 14px; border-radius: 999px; background: var(--gm-surface); font-weight: 650; font-size: 13.5px; color: var(--gm-ink-2); transition: all .3s var(--gm-ease-spring); }
    .filters button.on { background: var(--gm-navy); color: #fff; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .badge { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 6px 12px; color: var(--gm-ink); }
    .badge b { font-size: 12.5px; text-align: center; line-height: 1.2; }
    .badge small { font-size: 11px; color: var(--gm-ink-3); font-weight: 650; }
    .medal { position: relative; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; }
    .prog { position: absolute; inset: 0; transform: rotate(-90deg); }
    .prog circle { fill: none; stroke: #edf2f6; stroke-width: 4; }
    .prog .p { stroke: var(--gm-accent); stroke-linecap: round; stroke-dasharray: 182; transition: stroke-dashoffset 1s var(--gm-ease-out); }
    .disc { width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; color: #a9b6c3; background: #eef2f6; position: relative; overflow: hidden; }
    .earned .disc { color: #fff; background: linear-gradient(135deg, #e7b98a, #b7703f); box-shadow: 0 6px 14px rgba(183,112,63,.35), inset 0 1px 0 rgba(255,255,255,.5); }
    .earned[data-tier='silver'] .disc, [data-tier='silver'] .earned .disc { background: linear-gradient(135deg, #e6edf3, #8fa3b5); box-shadow: 0 6px 14px rgba(110,130,150,.35); }
    .earned[data-tier='gold'] .disc, [data-tier='gold'] .earned .disc { background: linear-gradient(135deg, #ffd27a, #e09b1c); box-shadow: 0 6px 14px rgba(224,155,28,.4); }
    .earned .disc::after { content: ''; position: absolute; top: 0; left: -80%; width: 50%; height: 100%; background: linear-gradient(100deg, transparent, rgba(255,255,255,.6), transparent); transform: skewX(-20deg); animation: gm-shine 3.5s ease-in-out infinite; }
    .earned .prog .p { stroke: transparent; }
    .detail-backdrop { position: fixed; inset: 0; z-index: 900; background: rgba(11,27,43,.3); animation: gm-fade-in .25s; }
    .detail { position: fixed; left: 16px; right: 16px; bottom: calc(24px + env(safe-area-inset-bottom)); z-index: 901; padding: 22px; text-align: center; border-radius: 26px !important; animation: gm-fade-up .45s var(--gm-ease-spring); }
    .medal.big { width: 88px; height: 88px; margin: 0 auto 8px; }
    .medal.big .disc { width: 88px; height: 88px; font-size: 38px; animation: gm-pop .6s var(--gm-ease-spring); }
    .detail h3 { margin: 4px 0; font-size: 20px; font-weight: 800; }
    .detail p { margin: 0 0 12px; color: var(--gm-ink-2); }
    .bar { height: 6px; border-radius: 3px; background: #edf2f6; overflow: hidden; margin-bottom: 8px; }
    .bar span { display: block; height: 100%; background: var(--gm-accent); transform-origin: left; transition: transform .8s var(--gm-ease-out); }
    .detail small { display: block; color: var(--gm-ink-3); margin-bottom: 14px; }
    .fine { text-align: center; font-size: 12px; color: var(--gm-ink-3); margin-top: 18px; }
  `,
})
export class AchievementsPage {
  protected a = inject(AchievementsService);
  private platform = inject(PlatformService);
  protected readonly Math = Math;
  readonly levels = LEVELS;
  readonly total = this.a.badges().length;
  readonly filters = [{ id: 'all', label: 'All' }, { id: 'earned', label: 'Earned' }, { id: 'next', label: 'In progress' }] as const;
  readonly filter = signal<'all' | 'earned' | 'next'>('all');
  readonly selected = signal<BadgeView | null>(null);
  readonly shown = computed(() => {
    const f = this.filter();
    const list = this.a.badges();
    if (f === 'earned') return list.filter((b) => b.earned);
    if (f === 'next') return list.filter((b) => !b.earned).sort((x, y) => y.progress - x.progress);
    return [...list].sort((x, y) => Number(y.earned) - Number(x.earned));
  });

  constructor() {
    void this.a.load();
  }

  setFilter(f: 'all' | 'earned' | 'next') {
    this.platform.selection();
    this.filter.set(f);
  }

  select(b: BadgeView) {
    this.platform.tap();
    this.selected.set(b);
  }

  date(iso?: string) {
    return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  }
}
