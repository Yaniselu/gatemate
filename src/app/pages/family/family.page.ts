import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertController, IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { GatemateApi } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { PlatformService } from '../../core/services/platform.service';
import { Companion, Relation } from '../../core/models';
import { DocumentScanComponent } from '../../shared/components/document-scan.component';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { t as tr, TranslatePipe } from '../../core/i18n/i18n.service';

export const RELATIONS: { id: Relation; label: string; icon: string }[] = [
  { id: 'partner', label: 'Partner', icon: 'heart-outline' },
  { id: 'child', label: 'Child', icon: 'happy-outline' },
  { id: 'parent', label: 'Parent', icon: 'person-outline' },
  { id: 'sibling', label: 'Sibling', icon: 'people-outline' },
  { id: 'relative', label: 'Relative', icon: 'home-outline' },
  { id: 'friend', label: 'Friend', icon: 'chatbubbles-outline' },
];

@Component({
  selector: 'gm-family',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, FormsModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, DocumentScanComponent, RevealDirective],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/profile" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>{{ 'Family' | t }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <div class="page">
        <p class="lead">{{ 'Add the people you travel with once. Then put them on any ticket in one tap: one booking, everyone’s pass in your phone.' | t }}</p>

        @if (scanFor(); as c) {
          <p class="for">{{ 'Verifying {name}' | t: { name: c.firstName + ' ' + c.lastName } }}</p>
          <gm-document-scan [busy]="busy()" (done)="verify(c, $event)" (cancel)="scanFor.set(null)" />
        } @else {
          @for (c of list(); track c.id; let i = $index) {
            <div class="member card" [gmReveal]="i">
              <span class="av">{{ (c.firstName[0] || '') + (c.lastName[0] || '') }}</span>
              <div class="txt">
                <b>{{ c.firstName }} {{ c.lastName }}</b>
                <small>{{ relationLabel(c.relation) | t }} · @if (c.verified) { <span class="v"><ion-icon name="shield-checkmark" />{{ 'Verified' | t }}</span> } @else { {{ 'Not verified' | t }} }</small>
              </div>
              @if (!c.verified) { <button class="mini" (click)="scanFor.set(c)" [attr.aria-label]="'Verify with passport' | t"><ion-icon name="id-card-outline" /></button> }
              <button class="mini danger" (click)="remove(c)" [attr.aria-label]="'Remove' | t"><ion-icon name="trash-outline" /></button>
            </div>
          } @empty {
            @if (loaded()) { <div class="empty card"><ion-icon name="people-outline" /><p>{{ 'No family members yet.' | t }}</p></div> }
          }

          <form class="add card" (submit)="$event.preventDefault(); add()">
            <h3><ion-icon name="person-add-outline" />{{ 'Add someone' | t }}</h3>
            <div class="two">
              <input [(ngModel)]="first" name="first" [placeholder]="'First name(s)' | t" autocomplete="off" maxlength="60" />
              <input [(ngModel)]="last" name="last" [placeholder]="'Last name' | t" autocomplete="off" maxlength="60" />
            </div>
            <div class="rel">
              @for (r of relations; track r.id) {
                <button type="button" [class.on]="relation() === r.id" (click)="relation.set(r.id)"><ion-icon [name]="r.icon" />{{ r.label | t }}</button>
              }
            </div>
            <p class="hint">{{ 'Write names exactly as in their passport, so they match the ticket.' | t }}</p>
            <button class="gm-btn" type="submit" [disabled]="!first.trim() || !last.trim() || busy()">{{ 'Add to family' | t }}</button>
          </form>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .page { padding: 12px 16px 40px; display: flex; flex-direction: column; gap: 12px; }
    .lead { margin: 0 2px 4px; font-size: 14.5px; line-height: 1.45; color: var(--gm-ink-2); }
    .for { margin: 0; font-weight: 750; }
    .member { display: flex; align-items: center; gap: 12px; padding: 12px 12px 12px 14px; }
    .av { width: 42px; height: 42px; flex: none; border-radius: 50%; display: grid; place-items: center; font-weight: 800; color: #fff;
      background: linear-gradient(135deg, #0fa8b6, #6366f1); }
    .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .txt b { font-size: 15.5px; font-weight: 750; }
    .txt small { color: var(--gm-ink-3); font-size: 13px; }
    .v { color: #16a34a; font-weight: 700; display: inline-flex; align-items: center; gap: 3px; }
    .mini { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; font-size: 18px; background: var(--gm-surface); color: var(--gm-accent-strong); }
    .mini.danger { color: var(--gm-coral); }
    .empty { display: flex; align-items: center; gap: 10px; padding: 16px; color: var(--gm-ink-3); }
    .empty p { margin: 0; }
    .add { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    .add h3 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 800; }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    input { width: 100%; min-width: 0; padding: 12px; border-radius: 12px; border: 1px solid var(--gm-card-border); background: var(--gm-surface); color: var(--gm-ink); font-size: 16px; }
    .rel { display: flex; flex-wrap: wrap; gap: 6px; }
    .rel button { display: inline-flex; align-items: center; gap: 5px; padding: 7px 11px; border-radius: 999px; font-size: 13.5px; font-weight: 650;
      background: var(--gm-surface); color: var(--gm-ink-2); }
    .rel button.on { background: var(--gm-on-accent-bg); color: #fff; }
    .hint { margin: 0; font-size: 12.5px; color: var(--gm-ink-3); }
    .gm-btn { justify-content: center; }
  `,
})
export class FamilyPage implements OnInit {
  private api = inject(GatemateApi);
  private toast = inject(ToastService);
  private platform = inject(PlatformService);
  private alerts = inject(AlertController);
  readonly relations = RELATIONS;
  readonly list = signal<Companion[]>([]);
  readonly loaded = signal(false);
  readonly busy = signal(false);
  readonly scanFor = signal<Companion | null>(null);
  readonly relation = signal<Relation>('child');
  first = '';
  last = '';

  async ngOnInit() {
    try {
      this.list.set(await this.api.getCompanions());
    } catch {
      void this.toast.show('Couldn’t load your family. Check your connection.', 'error');
    } finally {
      this.loaded.set(true);
    }
  }

  relationLabel(r: Relation) {
    return RELATIONS.find((x) => x.id === r)?.label ?? 'Relative';
  }

  async add() {
    const first = this.first.trim(), last = this.last.trim();
    if (!first || !last) return;
    this.busy.set(true);
    try {
      const c = await this.api.addCompanion({ firstName: first, lastName: last, relation: this.relation() });
      this.list.update((l) => [...l, c]);
      this.first = '';
      this.last = '';
      this.platform.impact();
    } catch (e) {
      void this.toast.show(e instanceof Error ? e.message : 'Couldn’t add them.', 'error');
    } finally {
      this.busy.set(false);
    }
  }

  async verify(c: Companion, lines: string[]) {
    this.busy.set(true);
    try {
      const v = await this.api.verifyCompanion(c.id, lines);
      this.list.update((l) => l.map((x) => (x.id === v.id ? v : x)));
      this.scanFor.set(null);
      void this.toast.show('Verified with their document.', 'success');
    } catch (e) {
      void this.toast.show(e instanceof Error ? e.message : 'Could not verify this document.', 'error');
    } finally {
      this.busy.set(false);
    }
  }

  async remove(c: Companion) {
    const a = await this.alerts.create({
      header: tr('Remove {name}?', { name: c.firstName }),
      message: tr('They will stay on tickets they’re already on.'),
      buttons: [{ text: tr('Cancel'), role: 'cancel' }, { text: tr('Remove'), role: 'destructive' }],
    });
    await a.present();
    if ((await a.onDidDismiss()).role !== 'destructive') return;
    try {
      await this.api.removeCompanion(c.id);
      this.list.update((l) => l.filter((x) => x.id !== c.id));
    } catch {
      void this.toast.show('Couldn’t remove them. Try again.', 'error');
    }
  }
}
