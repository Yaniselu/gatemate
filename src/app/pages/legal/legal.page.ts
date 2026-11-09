import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { LEGAL_DOCS } from './legal-content';
import { TranslatePipe } from '../../core/i18n/i18n.service';

@Component({
  selector: 'gm-legal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/welcome" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>{{ docData().title | t }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <article class="page anim-fade-up">
        <h1>{{ docData().title | t }}</h1>
        <p class="updated">{{ 'Last updated {date}' | t: { date: docData().updated } }}</p>
        <p class="intro">{{ docData().intro }}</p>
        @for (s of docData().sections; track s.heading) {
          <section>
            <h2>{{ s.heading }}</h2>
            @for (p of s.body; track $index) {
              <p>{{ p }}</p>
            }
          </section>
        }
        <p class="contact">{{ 'Questions? Write to' | t }} <b class="selectable">contact&#64;velosyntech.com</b></p>
      </article>
    </ion-content>
  `,
  styles: `
    .page { padding: 12px 22px 60px; max-width: 680px; margin: 0 auto; }
    h1 { font-size: 28px; font-weight: 850; margin: 6px 0 4px; }
    .updated { color: var(--gm-ink-3); font-size: 13px; margin: 0 0 16px; }
    .intro { font-size: 16px; line-height: 1.55; color: var(--gm-ink-2); }
    h2 { font-size: 18px; font-weight: 750; margin: 24px 0 6px; }
    p { font-size: 15px; line-height: 1.6; color: var(--gm-ink-2); margin: 0 0 10px; -webkit-user-select: text; user-select: text; }
    .contact { margin-top: 28px; padding: 14px; border-radius: 14px; background: var(--gm-surface); }
  `,
})
export class LegalPage {
  readonly doc = input('privacy');
  readonly docData = computed(() => LEGAL_DOCS[this.doc()] ?? LEGAL_DOCS['privacy']);
}
