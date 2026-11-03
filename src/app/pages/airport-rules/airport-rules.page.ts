import { input, effect, ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { PressableDirective } from '../../shared/directives/pressable.directive';
import { t, TranslatePipe } from '../../core/i18n/i18n.service';
import { AIRPORT_RULES, AirportRule, RULE_CATEGORIES, RuleCategory } from './airport-rules.data';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

@Component({
  selector: 'gm-airport-rules',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, FormsModule, RouterLink, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, RevealDirective, PressableDirective],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/home" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>{{ 'Airport rules' | t }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <div class="page">
        <section class="hero anim-scale-in">
          <span class="badge"><ion-icon name="reader-outline" /></span>
          <h2>{{ 'Airport rules' | t }}</h2>
          <p>{{ 'From your front door to your seat: the rules that save you time, money and stress.' | t }}</p>
          <div class="stats">
            <span><b>{{ total }}</b> {{ 'rules' | t }}</span>
            <span><b>{{ categories.length }}</b> {{ 'categories' | t }}</span>
            <span><ion-icon name="cloud-offline-outline" /> {{ 'works offline' | t }}</span>
          </div>
        </section>

        <div class="search">
          <ion-icon name="search-outline" />
          <input type="search" [placeholder]="'Search the rules: power bank, liquids, passport…' | t" [ngModel]="query()"
                 (ngModelChange)="query.set($event)" [attr.aria-label]="'Search the rules' | t" enterkeyhint="search" />
          @if (query()) { <button class="clear" (click)="query.set('')" aria-label="×"><ion-icon name="close-circle" /></button> }
        </div>

        <div class="chips" role="tablist">
          <button role="tab" [class.on]="cat() === null" [attr.aria-selected]="cat() === null" (click)="cat.set(null)">{{ 'All' | t }}</button>
          @for (c of categories; track c.id) {
            <button role="tab" [class.on]="cat() === c.id" [attr.aria-selected]="cat() === c.id" [style.--c]="c.color" (click)="cat.set(cat() === c.id ? null : c.id)">
              <ion-icon [name]="c.icon" />{{ c.label | t }}
            </button>
          }
        </div>

        <label class="must-only">
          <input type="checkbox" [ngModel]="mustOnly()" (ngModelChange)="mustOnly.set($event)" />
          <span class="switch"></span>{{ 'Only the must-knows' | t }}
        </label>

        @for (g of groups(); track g.cat.id) {
          <h3 class="sec" [style.--c]="g.cat.color">
            <span class="ic"><ion-icon [name]="g.cat.icon" /></span>{{ g.cat.label | t }}<small>{{ g.rules.length }}</small>
          </h3>
          @for (r of g.rules; track r.title; let i = $index) {
            <article class="rule" [class.tip]="r.kind === 'tip'" [style.--c]="g.cat.color" [gmReveal]="i">
              <span class="kind">
                <ion-icon [name]="r.kind === 'must' ? 'alert-circle-outline' : 'bulb-outline'" />{{ (r.kind === 'must' ? 'Must' : 'Tip') | t }}
              </span>
              <h4>{{ r.title | t }}</h4>
              <p>{{ r.body | t }}</p>
            </article>
          }
        } @empty {
          <p class="empty">{{ 'No rule matches. Try another word, or ask Velo.' | t }}</p>
        }

        <a class="velo" routerLink="/assistant" [queryParams]="{ prompt: veloPrompt }" gmPressable>
          <i class="orb" aria-hidden="true"></i>
          <span class="txt"><b>{{ 'Not sure about your airport?' | t }}</b><small>{{ 'Velo checks the rules for your next flight and the airports on your route.' | t }}</small></span>
          <span class="go">{{ 'Ask Velo' | t }} <ion-icon name="chevron-forward" /></span>
        </a>

        <p class="fine">{{ 'General rules for the EU and most airlines, checked in 2026. Airlines, airports and countries can be stricter: confirm with them before you fly.' | t }}</p>
      </div>
    </ion-content>
  `,
  styles: `
    .page { padding: 8px 16px 40px; max-width: 720px; margin: 0 auto; }

    .hero { position: relative; overflow: hidden; padding: 22px 20px 18px; border-radius: 28px; color: #fff;
      background: radial-gradient(120% 140% at 100% 0%, #8b5cf6 0%, transparent 55%), linear-gradient(135deg, #0fb5c3, #3b82f6 55%, #6366f1);
      box-shadow: 0 18px 40px rgba(59, 130, 246, .28); }
    .hero::after { content: ''; position: absolute; width: 220px; height: 220px; right: -70px; bottom: -110px; border-radius: 50%;
      border: 2px dashed rgba(255,255,255,.28); animation: spin 40s linear infinite; }
    .badge { display: inline-flex; padding: 10px; border-radius: 16px; background: rgba(255,255,255,.2); font-size: 28px; }
    .hero h2 { margin: 12px 0 6px; font-size: 26px; font-weight: 850; letter-spacing: -.02em; }
    .hero p { margin: 0; max-width: 460px; line-height: 1.45; font-size: 14.5px; opacity: .94; }
    .stats { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
    .stats span { display: inline-flex; align-items: center; gap: 5px; padding: 6px 11px; border-radius: 999px; font-size: 12.5px; font-weight: 650; background: rgba(8,20,40,.22); }
    .stats b { font-size: 14px; font-weight: 850; }
    @keyframes spin { to { rotate: 360deg; } }

    .search { display: flex; align-items: center; gap: 8px; height: 48px; padding: 0 14px; margin: 16px 0 12px; border-radius: 16px;
      background: var(--gm-surface); }
    .search ion-icon { color: var(--gm-ink-3); font-size: 19px; flex: none; }
    .search input { flex: 1; min-width: 0; border: 0; outline: none; background: none; font-size: 16px; color: var(--gm-ink); }
    .search .clear { display: flex; background: none; padding: 4px; }

    .chips { display: flex; gap: 8px; overflow-x: auto; overflow-y: hidden; overscroll-behavior-x: contain; margin: 0 -16px; padding: 2px 16px 6px; scrollbar-width: none; }
    .chips::-webkit-scrollbar { display: none; }
    .chips button { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 8px 13px; border-radius: 999px; font-size: 13px; font-weight: 650;
      color: var(--gm-ink-2); background: var(--gm-surface); transition: background .25s, color .25s, transform .25s var(--gm-ease-spring); }
    .chips button ion-icon { font-size: 16px; color: var(--c, var(--gm-ink-3)); transition: color .25s; }
    .chips button:active { transform: scale(.95); }
    .chips button.on { color: #fff; background: var(--c, var(--gm-solid)); }
    .chips button.on ion-icon { color: #fff; }

    .must-only { display: inline-flex; align-items: center; gap: 10px; margin: 10px 2px 2px; font-size: 14px; font-weight: 600; color: var(--gm-ink-2); cursor: pointer; }
    .must-only input { position: absolute; opacity: 0; pointer-events: none; }
    .switch { position: relative; width: 40px; height: 24px; border-radius: 999px; background: #cbd5e1; transition: background .25s; }
    .switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--gm-card-bg);
      box-shadow: 0 1px 3px rgba(0,0,0,.2); transition: transform .3s var(--gm-ease-spring); }
    .must-only input:checked + .switch { background: #ef4444; }
    .must-only input:checked + .switch::after { transform: translateX(16px); }
    .must-only input:focus-visible + .switch { outline: 2px solid var(--gm-accent); outline-offset: 2px; }

    .sec { display: flex; align-items: center; gap: 10px; margin: 26px 0 10px; font-size: 17px; font-weight: 800; color: var(--gm-ink); }
    .sec .ic { width: 34px; height: 34px; border-radius: 11px; display: flex; align-items: center; justify-content: center; font-size: 18px;
      color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); }
    .sec small { margin-left: auto; font-size: 12px; font-weight: 700; color: var(--gm-ink-3); padding: 3px 9px; border-radius: 999px; background: var(--gm-surface); }

    .rule { position: relative; padding: 14px 16px 15px; margin-bottom: 10px; border-radius: 20px; background: var(--gm-card-bg, #fff);
      border: 1px solid var(--gm-card-border, rgba(15,23,42,.06)); box-shadow: 0 6px 20px rgba(15, 23, 42, .05); overflow: hidden; }
    .rule::before { content: ''; position: absolute; width: 120px; height: 120px; right: -50px; top: -60px; border-radius: 50%;
      background: var(--c); opacity: .09; }
    .kind { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px 3px 7px; border-radius: 999px; font-size: 11.5px; font-weight: 800;
      letter-spacing: .02em; text-transform: uppercase; color: #b91c1c; background: rgba(239, 68, 68, .1); }
    .kind ion-icon { font-size: 14px; }
    .rule.tip .kind { color: #b45309; background: rgba(245, 158, 11, .14); }
    :host-context(html.gm-dark) .rule.tip .kind { color: #fbbf24; background: rgba(245, 158, 11, .16); }
    .rule h4 { margin: 9px 0 4px; font-size: 16px; font-weight: 750; line-height: 1.3; color: var(--gm-ink); }
    .rule p { margin: 0; font-size: 14px; line-height: 1.5; color: var(--gm-ink-2); }

    .empty { padding: 30px 10px; text-align: center; color: var(--gm-ink-3); }

    .velo { display: flex; align-items: center; gap: 14px; margin-top: 26px; padding: 16px; border-radius: 22px; text-decoration: none; color: #fff;
      background: linear-gradient(135deg, #1e1b4b, #4c1d95 60%, #0e7490); box-shadow: 0 16px 36px rgba(76, 29, 149, .3); }
    .orb { flex: none; position: relative; width: 44px; height: 44px; border-radius: 50%;
      background: conic-gradient(from 0deg, #22c7d3, #8b5cf6, #ec4899, #f97316, #22c7d3); animation: spin 6s linear infinite; }
    .orb::after { content: ''; position: absolute; inset: 18%; border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, rgba(255,255,255,.95), rgba(255,255,255,.25) 45%, transparent 70%); }
    .velo .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .velo b { font-size: 15.5px; }
    .velo small { font-size: 12.5px; line-height: 1.4; opacity: .85; }
    .velo .go { flex: none; display: inline-flex; align-items: center; gap: 2px; padding: 8px 12px; border-radius: 999px; font-size: 13px; font-weight: 750;
      background: rgba(255,255,255,.16); }

    .fine { margin: 18px 4px 0; font-size: 12px; line-height: 1.5; color: var(--gm-ink-3); }

    @media (prefers-reduced-motion: reduce) { .hero::after, .orb { animation: none; } }
  `,
})
export class AirportRulesPage {
  readonly categories = RULE_CATEGORIES;
  readonly total = AIRPORT_RULES.length;
  readonly veloPrompt = 'Which airport and security rules apply to my next flight? Check my route, my cabin bag and any connection.';

  readonly q = input<string | undefined>();
  readonly query = signal('');
  private fromSearch = effect(() => {
    const q = this.q();
    if (q) this.query.set(q);
  });
  readonly cat = signal<string | null>(null);
  readonly mustOnly = signal(false);

  private readonly index = AIRPORT_RULES.map((r) => ({ r, text: fold([r.title, r.body, t(r.title), t(r.body)].join(' ')) }));

  readonly groups = computed(() => {
    const q = fold(this.query().trim());
    const words = q ? q.split(/\s+/) : [];
    const hits = this.index
      .filter(({ r, text }) => (this.cat() === null || r.cat === this.cat()) && (!this.mustOnly() || r.kind === 'must') && words.every((w) => text.includes(w)))
      .map(({ r }) => r);
    const out: { cat: RuleCategory; rules: AirportRule[] }[] = [];
    for (const c of this.categories) {
      const rules = hits.filter((r) => r.cat === c.id);
      if (rules.length) out.push({ cat: c, rules });
    }
    return out;
  });
}
