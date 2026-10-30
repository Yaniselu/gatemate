import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { ClaimBuilderComponent } from '../../shared/components/claim-builder.component';

@Component({
  selector: 'gm-rights',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, ClaimBuilderComponent, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, RevealDirective],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/home" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>{{ 'Passenger rights' | t }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <div class="page">
        <div class="intro glass tinted anim-scale-in">
          <ion-icon name="scale-outline" />
          <h2>{{ 'Know your rights' | t }}</h2>
          <p>{{ 'Flying from the EU, or to the EU with an EU airline? Regulation (EC) No 261/2004 may entitle you to care and compensation.' | t }}</p>
        </div>

        <h3 class="sub">{{ 'Estimate compensation' | t }}</h3>
        <div class="calc glass flat">
          <div class="opts">
            @for (d of distances; track d.id) {
              <button [class.on]="distance() === d.id" (click)="distance.set(d.id)">{{ d.label | t }}</button>
            }
          </div>
          <div class="amount">
            <small>{{ 'Up to' | t }}</small>
            <b>€{{ amount() }}</b>
            <span>{{ 'per passenger, if the delay at arrival is 3 h or more, or the flight is cancelled at short notice — unless caused by extraordinary circumstances.' | t }}</span>
          </div>
        </div>

        <h3 class="sub">{{ 'What to do' | t }}</h3>
        @for (s of steps; track s.title; let i = $index) {
          <div class="step" [gmReveal]="i">
            <span class="n">{{ i + 1 }}</span>
            <div><b>{{ s.title | t }}</b><p>{{ s.body | t }}</p></div>
          </div>
        }

        <gm-claim-builder />

        <p class="disclaimer">{{ 'This is general information, not legal advice. Eligibility depends on your route, airline and the cause of disruption. Contact your airline or national enforcement body for a binding answer.' | t }}</p>
      </div>
    </ion-content>
  `,
  styles: `
    .page { padding: 8px 18px 40px; }
    .intro { padding: 20px; border-radius: 26px; }
    .intro ion-icon { font-size: 32px; padding: 10px; border-radius: 16px; background: rgba(255,255,255,.2); }
    .intro h2 { color: #fff; margin: 12px 0 6px; font-size: 22px; font-weight: 800; }
    .intro p { margin: 0; opacity: .92; line-height: 1.45; font-size: 14.5px; }
    .sub { font-size: 18px; font-weight: 750; margin: 26px 0 12px; }
    .calc { padding: 16px; border-radius: 22px; }
    .opts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .opts button { padding: 10px 4px; border-radius: 12px; background: var(--gm-surface); font-weight: 650; font-size: 12.5px; color: var(--gm-ink-2); transition: all .3s var(--gm-ease-spring); }
    .opts button.on { background: var(--gm-solid); color: #fff; transform: scale(1.03); }
    .amount { margin-top: 16px; }
    .amount small { color: var(--gm-ink-3); font-weight: 600; }
    .amount b { display: block; font-size: 44px; font-weight: 850; color: var(--gm-accent-strong); letter-spacing: -.03em; animation: gm-scale-in .4s var(--gm-ease-spring); }
    .amount span { font-size: 13px; color: var(--gm-ink-2); line-height: 1.45; }
    .step { display: flex; gap: 14px; padding: 12px 0; }
    .n { flex: none; width: 32px; height: 32px; border-radius: 50%; background: var(--gm-accent-soft); color: var(--gm-accent-deep); font-weight: 800; display: flex; align-items: center; justify-content: center; }
    .step b { font-size: 15.5px; }
    .step p { margin: 3px 0 0; color: var(--gm-ink-2); font-size: 14px; line-height: 1.45; }
    .disclaimer { margin-top: 20px; font-size: 12px; color: var(--gm-ink-3); line-height: 1.5; }
  `,
})
export class RightsPage {
  readonly distances = [
    { id: 'short', label: '≤ 1,500 km', amount: 250 },
    { id: 'mid', label: '1,500–3,500 km', amount: 400 },
    { id: 'long', label: '> 3,500 km', amount: 600 },
  ];
  readonly distance = signal('mid');
  amount() {
    return this.distances.find((d) => d.id === this.distance())?.amount ?? 0;
  }
  readonly steps = [
    { title: 'Ask for care at the airport', body: 'For long delays the airline must offer meals, refreshments and, if needed, a hotel and transfer.' },
    { title: 'Keep every document', body: 'Boarding pass, booking confirmation, receipts and the reason given for the delay.' },
    { title: 'Claim directly with the airline', body: 'Use the airline’s official claim form. You never need to pay a third party to claim.' },
    { title: 'Escalate if refused', body: 'Contact the national enforcement body of the country where the incident happened.' },
  ];
}
