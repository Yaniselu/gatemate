import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, NavController } from '@ionic/angular/standalone';
import { ProPlan, ProService } from '../../core/services/pro.service';
import { ToastService } from '../../core/services/toast.service';
import { PlatformService } from '../../core/services/platform.service';
import { ConfettiService } from '../../shared/components/confetti.service';
import { t as tr, TranslatePipe } from '../../core/i18n/i18n.service';

const FEATURES = [
  { icon: 'sparkles', title: '10× more Velo', body: '200 messages a day with your AI travel agent, instead of 20.' },
  { icon: 'airplane-outline', title: 'Unlimited tickets', body: 'Free accounts keep up to 5 upcoming tickets, your family’s included.' },
  { icon: 'compass-outline', title: 'Full city guides', body: 'Every top sight, not just the first eight.' },
  { icon: 'swap-horizontal-outline', title: 'Settle up in one tap', body: 'Who owes whom, with the fewest transfers, plus CSV export.' },
  { icon: 'heart-outline', title: 'Support an independent app', body: 'No ads, no selling your data — ever.' },
];

@Component({
  selector: 'gm-pro',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonContent, IonIcon, RouterLink],
  template: `
    <ion-content [fullscreen]="true">
      <button class="close" (click)="close()" [aria-label]="'Close' | t"><ion-icon name="close" /></button>
      <div class="wrap">
        <header class="hero anim-fade-up">
          <span class="crown"><ion-icon name="sparkles" /></span>
          <h1>{{ 'Gatemate Pro' | t }}</h1>
          <p>{{ headline() }}</p>
        </header>

        @if (pro.isPro()) {
          <section class="card done anim-scale-in">
            <ion-icon name="checkmark-circle" />
            <div><b>{{ 'You’re on Pro' | t }}</b><small>{{ 'Thanks for supporting Gatemate.' | t }}</small></div>
          </section>
          @if (!pro.demo) { <button class="gm-btn ghost" (click)="pro.manage()">{{ 'Manage subscription' | t }}</button> }
        } @else {
          <ul class="features">
            @for (f of features; track f.title; let i = $index) {
              <li [style.--i]="i"><span class="gm-well accent"><ion-icon [name]="f.icon" /></span><div><b>{{ f.title | t }}</b><small>{{ f.body | t }}</small></div></li>
            }
          </ul>

          @switch (pro.state()) {
            @case ('ready') {
              <div class="plans" role="radiogroup" [aria-label]="'Choose a plan' | t">
                @for (p of pro.plans(); track p.id) {
                  <button class="plan" role="radio" [attr.aria-checked]="selected()?.id === p.id" [class.on]="selected()?.id === p.id" (click)="select(p)">
                    <span class="radio"></span>
                    <span class="txt"><b>{{ p.title | t }}</b>@if (p.perMonth) { <small>{{ p.perMonth }}</small> }</span>
                    <span class="price">{{ p.price }}</span>
                    @if (p.id === 'annual') { <em class="save">{{ 'Best value' | t }}</em> }
                  </button>
                }
              </div>
              <button class="gm-btn buy" (click)="buy()" [disabled]="!selected() || pro.busy()">
                @if (pro.busy()) { <span class="spinner"></span> } @else { {{ selected()?.trial ? ('Start free trial' | t) : ('Subscribe' | t) }} }
              </button>
              <p class="terms">
                @if (selected(); as s) {
                  @if (s.trial) { {{ '{trial}, then {price}.' | t: { trial: s.trial, price: s.price } }} } @else { {{ s.price }}. }
                }
                {{ 'Auto-renews until cancelled. Cancel any time in your {store} settings at least 24 hours before renewal.' | t: { store: storeName } }}
                @if (pro.demo) { <b>{{ 'Demo build: no payment is taken.' | t }}</b> }
              </p>
            }
            @case ('loading') { <div class="loading"><span class="spinner dark"></span></div> }
            @default {
              <div class="card unavailable">
                <ion-icon name="storefront-outline" />
                <p>Subscriptions aren’t available in this build yet. They appear here once the app is set up in the {{ storeName }}.</p>
              </div>
            }
          }
          <div class="links">
            <button (click)="restore()" [disabled]="pro.busy()">{{ 'Restore purchases' | t }}</button>
            <a routerLink="/legal/terms">{{ 'Terms' | t }}</a>
            <a routerLink="/legal/privacy">{{ 'Privacy' | t }}</a>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .close { position: absolute; top: calc(env(safe-area-inset-top) + 10px); right: 14px; z-index: 5; width: 36px; height: 36px; border-radius: 50%; background: var(--gm-surface); color: var(--gm-ink); font-size: 20px; display: flex; align-items: center; justify-content: center; }
    .wrap { padding: calc(env(safe-area-inset-top) + 40px) 20px calc(env(safe-area-inset-bottom) + 24px); }
    .hero { text-align: center; margin-bottom: 18px; }
    .crown { width: 64px; height: 64px; border-radius: 20px; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; font-size: 30px; color: #fff;
      background: linear-gradient(135deg, var(--gm-accent), var(--gm-accent-deep)); box-shadow: 0 12px 26px rgba(10,147,166,.28); animation: gm-pop .6s var(--gm-ease-spring); }
    h1 { margin: 0 0 6px; font-size: 30px; font-weight: 800; letter-spacing: -0.02em; }
    .hero p { margin: 0; color: var(--gm-ink-2); font-size: 15.5px; }
    .features { list-style: none; padding: 0; margin: 0 0 18px; display: grid; gap: 12px; }
    .features li { display: flex; gap: 12px; align-items: center; animation: gm-fade-up .45s var(--gm-ease-out) both; animation-delay: calc(var(--i) * 70ms); }
    .features b { display: block; font-size: 15.5px; }
    .features small { color: var(--gm-ink-3); font-size: 13px; }
    .plans { display: grid; gap: 10px; }
    .plan { position: relative; display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 16px; background: var(--gm-card-bg); border: 1.5px solid var(--gm-card-border); text-align: left; color: var(--gm-ink); transition: border-color .2s, transform .2s var(--gm-ease-spring); }
    .plan:active { transform: scale(.98); }
    .plan.on { border-color: var(--gm-accent-strong); box-shadow: 0 0 0 3px rgba(15,181,195,.12); }
    .radio { width: 20px; height: 20px; border-radius: 50%; border: 2px solid #c7d0d8; flex: none; transition: all .2s; }
    .plan.on .radio { border: 6px solid var(--gm-accent-strong); }
    .txt { flex: 1; }
    .txt b { display: block; font-size: 16px; }
    .txt small { color: var(--gm-ink-3); font-size: 12.5px; }
    .price { font-weight: 700; font-size: 15px; }
    .save { position: absolute; top: -9px; right: 14px; font-style: normal; font-size: 11px; font-weight: 700; color: #fff; background: var(--gm-on-accent-bg); padding: 2px 8px; border-radius: 999px; }
    .buy { width: 100%; margin-top: 16px; }
    .terms { font-size: 12px; color: var(--gm-ink-3); text-align: center; line-height: 1.45; margin: 10px 4px 0; }
    .links { display: flex; justify-content: center; gap: 18px; margin-top: 14px; }
    .links button, .links a { background: none; font-size: 13.5px; font-weight: 600; color: var(--gm-accent-strong); text-decoration: none; }
    .done { display: flex; gap: 12px; align-items: center; padding: 16px; margin-bottom: 12px; }
    .done ion-icon { font-size: 32px; color: var(--gm-mint); }
    .done b { display: block; font-size: 17px; }
    .done small { color: var(--gm-ink-3); }
    .unavailable { display: flex; gap: 12px; align-items: center; padding: 16px; color: var(--gm-ink-2); }
    .unavailable ion-icon { font-size: 26px; color: var(--gm-ink-3); flex: none; }
    .unavailable p { margin: 0; font-size: 14px; }
    .loading { display: flex; justify-content: center; padding: 30px; }
    .spinner.dark { border-color: rgba(11,27,43,.15); border-top-color: var(--gm-ink); }
  `,
})
export class ProPage implements OnInit {
  protected pro = inject(ProService);
  private toast = inject(ToastService);
  private platform = inject(PlatformService);
  private confetti = inject(ConfettiService);
  private nav = inject(NavController);

  readonly reason = input<string | undefined>();
  readonly features = FEATURES;
  readonly storeName = this.platform.isNative && !this.platform.isIos ? 'Google Play' : 'App Store';
  private chosen = signal<ProPlan | null>(null);
  readonly selected = computed<ProPlan | null>(() => this.chosen() ?? this.pro.plans()[0] ?? null);
  readonly headline = computed(() => {
    if (this.pro.isPro()) return tr('Everything in Gatemate, without limits.');
    switch (this.reason()) {
      case 'trips': return tr('You’ve reached 5 upcoming tickets on the free plan. Go unlimited.');
      case 'explore': return tr('See every top sight in the cities you visit.');
      case 'expenses': return tr('Settle up with your travel group in one tap.');
      case 'velo': return tr('Plan more with Velo: 200 messages a day.');
      default: return tr('Everything in Gatemate, without limits.');
    }
  });

  ngOnInit() {
    void this.pro.loadPlans();
  }

  select(p: ProPlan) {
    this.platform.selection();
    this.chosen.set(p);
  }

  async buy() {
    const p = this.selected();
    if (!p) return;
    try {
      if (await this.pro.purchase(p)) {
        this.platform.success();
        this.confetti.burst(0.5, 0.3, 90);
        void this.toast.show('Welcome to Gatemate Pro', 'success', 'sparkles');
      }
    } catch {
      void this.toast.show('The purchase didn’t go through. You haven’t been charged.', 'error');
    }
  }

  async restore() {
    try {
      const ok = await this.pro.restore();
      void this.toast.show(ok ? 'Purchases restored — you’re on Pro' : 'No active subscription found for this Apple ID / Google account.', ok ? 'success' : 'info');
    } catch {
      void this.toast.show('Couldn’t reach the store. Try again.', 'error');
    }
  }

  close() {
    void this.nav.back();
  }
}
