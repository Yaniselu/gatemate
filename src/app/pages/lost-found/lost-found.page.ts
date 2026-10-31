import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { AlertController, IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { deadline, LostCase, LostFoundService, LostKind } from '../../core/services/lost-found.service';
import { TravelStore } from '../../core/services/travel.store';
import { AuthService } from '../../core/services/auth.service';
import { PlatformService } from '../../core/services/platform.service';
import { ToastService } from '../../core/services/toast.service';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { locale, t as tr, TranslatePipe } from '../../core/i18n/i18n.service';
import { LOST_GUIDES, LostGuide } from './lost-found.data';

interface Draft {
  id?: string;
  flightId: string;
  airline: string;
  flight: string;
  date: string;
  airport: string;
  reference: string;
  item: string;
  details: string;
  receivedAt: string;
  expenses: number | null;
  currency: string;
}

@Component({
  selector: 'gm-lost-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, FormsModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, RevealDirective],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/home" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>{{ 'Lost & Found' | t }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <div class="page">
        <section class="hero anim-scale-in">
          <span class="badge"><ion-icon name="search-outline" /></span>
          <h2>{{ 'Lost something on your trip?' | t }}</h2>
          <p>{{ 'Pick what happened. You get the exact steps, your legal deadlines and a claim letter ready to send.' | t }}</p>
        </section>

        <div class="kinds">
          @for (g of guides; track g.kind; let i = $index) {
            <button class="kind card" [class.on]="open() === g.kind" [style.--c]="g.color" (click)="choose(g.kind)" [gmReveal]="i">
              <span class="ic"><ion-icon [name]="g.icon" /></span>
              <b>{{ g.title | t }}</b>
              <small>{{ g.short | t }}</small>
            </button>
          }
        </div>

        @if (guide(); as g) {
          <section class="guide card anim-fade-up" [style.--c]="g.color" id="lf-guide">
            <h3><ion-icon [name]="g.icon" />{{ g.title | t }}</h3>
            <div class="facts">
              @for (f of g.facts; track f) { <span><ion-icon name="time-outline" />{{ f | t }}</span> }
            </div>
            <ol>
              @for (s of g.steps; track s; let i = $index) { <li><span class="n">{{ i + 1 }}</span><p>{{ s | t }}</p></li> }
            </ol>
            @if (!draft()) {
              <button class="gm-btn" (click)="start(g)"><ion-icon name="document-text-outline" />{{ 'Start a case' | t }}</button>
            }
          </section>
        }

        @if (draft(); as d) {
          <form class="form card anim-fade-up" (submit)="$event.preventDefault(); save()" id="lf-form">
            <h3>{{ d.id ? ('Edit case' | t) : ('New case' | t) }}</h3>
            @if (flights().length) {
              <label>{{ 'Flight' | t }}</label>
              <select [(ngModel)]="d.flightId" name="flight" (ngModelChange)="pickFlight($event)">
                <option value="">{{ 'Another flight' | t }}</option>
                @for (f of flights(); track f.id) { <option [value]="f.id">{{ f.number }} · {{ f.from.code }} → {{ f.to.code }} · {{ day(f.departure) }}</option> }
              </select>
            }
            @if (!d.flightId) {
              <div class="two">
                <div><label>{{ 'Airline' | t }}</label><input [(ngModel)]="d.airline" name="airline" maxlength="40" /></div>
                <div><label>{{ 'Flight number' | t }}</label><input [(ngModel)]="d.flight" name="fn" maxlength="10" placeholder="W6 3201" /></div>
              </div>
              <div class="two">
                <div><label>{{ 'Date' | t }}</label><input type="date" [(ngModel)]="d.date" name="date" /></div>
                <div><label>{{ 'Airport' | t }}</label><input [(ngModel)]="d.airport" name="airport" maxlength="40" placeholder="CRA" /></div>
              </div>
            }
            <label>{{ 'What did you lose?' | t }}</label>
            <input [(ngModel)]="d.item" name="item" maxlength="80" [placeholder]="(guide()?.itemHint ?? '') | t" required />
            <label>{{ (guide()?.refLabel ?? 'Reference') | t }} <i>{{ 'optional' | t }}</i></label>
            <input [(ngModel)]="d.reference" name="ref" maxlength="20" [placeholder]="guide()?.refHint ?? ''" autocapitalize="characters" />
            <label>{{ 'Description' | t }} <i>{{ 'colour, brand, what’s inside' | t }}</i></label>
            <textarea [(ngModel)]="d.details" name="details" rows="3" maxlength="400"></textarea>
            @if (open() === 'delayed' || open() === 'damaged') {
              <div class="two">
                <div><label>{{ open() === 'delayed' ? ('Bag delivered on' | t) : ('Bag received on' | t) }}</label><input type="date" [(ngModel)]="d.receivedAt" name="recv" /></div>
                <div><label>{{ 'Costs to claim' | t }}</label>
                  <div class="money"><input type="number" inputmode="decimal" min="0" [(ngModel)]="d.expenses" name="exp" placeholder="0" /><select [(ngModel)]="d.currency" name="cur">@for (c of currencies; track c) { <option>{{ c }}</option> }</select></div>
                </div>
              </div>
            }
            <div class="row">
              <button class="gm-btn ghost" type="button" (click)="draft.set(null)">{{ 'Cancel' | t }}</button>
              <button class="gm-btn" type="submit" [disabled]="!d.item.trim()">{{ 'Save case' | t }}</button>
            </div>
            <p class="note"><ion-icon name="lock-closed-outline" />{{ 'Saved only on this phone. We remind you 2 days before a deadline.' | t }}</p>
          </form>
        }

        @if (cases().length) {
          <h3 class="sec">{{ 'My cases' | t }}</h3>
          @for (c of cases(); track c.id; let i = $index) {
            <article class="case card" [class.done]="c.resolved" [style.--c]="guideOf(c.kind).color" [gmReveal]="i">
              <div class="head">
                <span class="ic"><ion-icon [name]="guideOf(c.kind).icon" /></span>
                <div class="txt">
                  <b>{{ c.item }}</b>
                  <small>{{ caseLine(c) }}</small>
                </div>
                @if (c.resolved) { <span class="chip ok">{{ 'Solved' | t }}</span> }
                @else if (left(c); as l) { <span class="chip" [class.warn]="l.days <= 3" [class.bad]="l.days < 0">{{ l.text }}</span> }
              </div>
              @if (letterFor() === c.id) {
                <pre class="letter">{{ letter(c) }}</pre>
                <div class="row wrap">
                  <button class="gm-btn small" (click)="copy(c)"><ion-icon name="copy-outline" />{{ copied() ? ('Copied' | t) : ('Copy' | t) }}</button>
                  <button class="gm-btn small" (click)="share(c)"><ion-icon name="share-outline" />{{ 'Share' | t }}</button>
                  <a class="gm-btn small" [href]="mailto(c)"><ion-icon name="mail-outline" />{{ 'E-mail' | t }}</a>
                </div>
                <p class="note">{{ 'Written in English, which every airline accepts. Add your bank details before sending.' | t }}</p>
              }
              <div class="actions">
                <button (click)="letterFor.set(letterFor() === c.id ? null : c.id)"><ion-icon name="document-text-outline" />{{ (c.kind === 'delayed' || c.kind === 'damaged') ? ('Claim letter' | t) : ('Message' | t) }}</button>
                <button (click)="edit(c)"><ion-icon name="create-outline" />{{ 'Edit' | t }}</button>
                <button (click)="toggleResolved(c)"><ion-icon name="checkmark-circle-outline" />{{ c.resolved ? ('Reopen' | t) : ('Solved' | t) }}</button>
                <button class="del" (click)="remove(c)" [attr.aria-label]="'Delete' | t"><ion-icon name="trash-outline" /></button>
              </div>
            </article>
          }
        }

        <p class="legal">{{ 'Baggage rules follow the Montreal Convention (Articles 17, 19, 22 and 31), which applies to most international flights and all EU airlines. Limits are 1,519 Special Drawing Rights per passenger.' | t }}</p>
      </div>
    </ion-content>
  `,
  styles: `
    .page { padding: 12px 16px 40px; display: flex; flex-direction: column; gap: 12px; }
    .hero { padding: 20px 18px; border-radius: 24px; color: #fff; background: linear-gradient(135deg, #d97706, #dc2626 55%, #7c3aed); box-shadow: 0 18px 40px rgba(239, 68, 68, .25); }
    .hero .badge { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; font-size: 24px; background: rgba(255,255,255,.2); }
    .hero h2 { margin: 12px 0 4px; font-size: 22px; font-weight: 850; }
    .hero p { margin: 0; font-size: 14.5px; line-height: 1.45; opacity: .95; }
    .kinds { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .kind { text-align: left; padding: 14px; display: flex; flex-direction: column; gap: 4px; border: 2px solid transparent; }
    .kind.on { border-color: var(--c); }
    .kind .ic, .case .ic { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; font-size: 20px; color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); }
    .kind b { margin-top: 6px; font-size: 14.5px; font-weight: 800; line-height: 1.25; color: var(--gm-ink); }
    .kind small { font-size: 12.5px; color: var(--gm-ink-3); }
    .guide, .form { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    h3 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 17px; font-weight: 800; }
    .guide h3 ion-icon { color: var(--c); }
    .facts { display: flex; flex-wrap: wrap; gap: 6px; }
    .facts span { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 999px; font-size: 12.5px; font-weight: 700;
      color: var(--gm-ink); background: color-mix(in srgb, var(--c) 14%, transparent); }
    ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    li { display: flex; gap: 10px; }
    li .n { width: 24px; height: 24px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: 12.5px; font-weight: 850; color: #fff; background: var(--c); }
    li p { margin: 1px 0 0; font-size: 14.5px; line-height: 1.45; color: var(--gm-ink-2); }
    label { font-size: 13px; font-weight: 700; color: var(--gm-ink-2); margin-top: 2px; }
    label i { font-style: normal; font-weight: 500; color: var(--gm-ink-3); }
    input, select, textarea { width: 100%; min-width: 0; padding: 11px 12px; border-radius: 12px; border: 1px solid var(--gm-card-border);
      background: var(--gm-surface); color: var(--gm-ink); font-size: 16px; font-family: inherit; }
    textarea { resize: none; }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .two > div { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .money { display: flex; gap: 6px; }
    .money select { width: 78px; flex: none; padding: 11px 6px; }
    .row { display: flex; gap: 8px; }
    .row .gm-btn { flex: 1; justify-content: center; }
    .row.wrap { flex-wrap: wrap; }
    .row.wrap .gm-btn { flex: 1 1 0; min-width: 0; padding-inline: 8px; white-space: nowrap; text-decoration: none; }
    .note { margin: 0; display: flex; gap: 6px; align-items: flex-start; font-size: 12.5px; color: var(--gm-ink-3); }
    .sec { margin-top: 8px; }
    .case { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
    .case.done { opacity: .7; }
    .head { display: flex; align-items: center; gap: 12px; }
    .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .txt b { font-size: 15.5px; font-weight: 800; overflow-wrap: anywhere; }
    .txt small { font-size: 13px; color: var(--gm-ink-3); }
    .chip { flex: none; padding: 4px 9px; border-radius: 999px; font-size: 12px; font-weight: 800; color: var(--gm-ink-2); background: var(--gm-surface); }
    .chip.warn { color: #b45309; background: rgba(245, 158, 11, .16); }
    .chip.bad { color: #fff; background: var(--gm-badge, #e5484d); }
    .chip.ok { color: #15803d; background: rgba(22, 163, 74, .14); }
    :host-context(html.gm-dark) .chip.warn { color: #fbbf24; }
    :host-context(html.gm-dark) .chip.ok { color: #4ade80; }
    .letter { margin: 0; padding: 12px; border-radius: 12px; background: var(--gm-surface); color: var(--gm-ink); white-space: pre-wrap; word-break: break-word;
      font: 13px/1.5 ui-monospace, Menlo, monospace; max-height: 340px; overflow: auto; }
    .actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .actions button { display: inline-flex; align-items: center; gap: 5px; padding: 8px 11px; border-radius: 10px; font-size: 13.5px; font-weight: 700;
      color: var(--gm-ink-2); background: var(--gm-surface); }
    .actions .del { margin-left: auto; color: var(--gm-coral); }
    .legal { margin: 6px 2px 0; font-size: 12px; line-height: 1.45; color: var(--gm-ink-3); }
  `,
})
export class LostFoundPage implements OnInit {
  private lf = inject(LostFoundService);
  private store = inject(TravelStore);
  private auth = inject(AuthService);
  private platform = inject(PlatformService);
  private toast = inject(ToastService);
  private alerts = inject(AlertController);
  readonly kind = input<LostKind | undefined>();

  readonly guides = LOST_GUIDES;
  readonly currencies = ['EUR', 'RON', 'GBP', 'USD', 'CHF', 'PLN', 'HUF'];
  readonly open = signal<LostKind | null>(null);
  readonly guide = computed(() => LOST_GUIDES.find((g) => g.kind === this.open()) ?? null);
  readonly draft = signal<Draft | null>(null);
  readonly letterFor = signal<string | null>(null);
  readonly copied = signal(false);
  readonly cases = this.lf.cases;
  readonly flights = computed(() =>
    this.store
      .trips()
      .flatMap((t) => t.flights)
      .filter((f) => +new Date(f.departure) < Date.now() + 2 * 86_400_000)
      .sort((a, b) => +new Date(b.departure) - +new Date(a.departure))
      .slice(0, 12),
  );

  async ngOnInit() {
    await this.lf.load();
    void this.store.loadTrips().catch(() => {});
    const k = this.kind();
    if (k && LOST_GUIDES.some((g) => g.kind === k)) this.open.set(k);
  }

  guideOf(k: LostKind): LostGuide {
    return LOST_GUIDES.find((g) => g.kind === k)!;
  }

  choose(k: LostKind) {
    this.platform.selection();
    this.open.set(this.open() === k ? null : k);
    this.draft.set(null);
    setTimeout(() => document.getElementById('lf-guide')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  start(g: LostGuide) {
    const last = this.flights()[0];
    this.draft.set({
      flightId: last?.id ?? '',
      airline: '', flight: '', date: new Date().toISOString().slice(0, 10), airport: '',
      reference: '', item: '', details: '', receivedAt: '', expenses: null, currency: 'EUR',
    });
    void g;
    setTimeout(() => document.getElementById('lf-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  pickFlight(id: string) {
    this.draft.update((d) => (d ? { ...d, flightId: id } : d));
  }

  edit(c: LostCase) {
    this.open.set(c.kind);
    this.draft.set({
      id: c.id, flightId: c.flightId ?? '', airline: c.airline ?? '', flight: c.flight ?? '', date: (c.date ?? c.createdAt).slice(0, 10),
      airport: c.airport ?? '', reference: c.reference ?? '', item: c.item, details: c.details ?? '', receivedAt: c.receivedAt?.slice(0, 10) ?? '',
      expenses: c.expenses ?? null, currency: c.currency ?? 'EUR',
    });
    setTimeout(() => document.getElementById('lf-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  async save() {
    const d = this.draft(), k = this.open();
    if (!d || !k || !d.item.trim()) return;
    const f = this.flights().find((x) => x.id === d.flightId);
    await this.lf.save({
      id: d.id,
      kind: k,
      flightId: f?.id,
      flight: f ? f.number : d.flight.trim().toUpperCase() || undefined,
      airline: f ? f.airline : d.airline.trim() || undefined,
      airport: f ? f.to.code : d.airport.trim().toUpperCase() || undefined,
      date: f ? f.departure : d.date ? new Date(d.date + 'T12:00:00').toISOString() : undefined,
      reference: d.reference.trim().toUpperCase() || undefined,
      item: d.item.trim(),
      details: d.details.trim() || undefined,
      receivedAt: d.receivedAt ? new Date(d.receivedAt + 'T12:00:00').toISOString() : undefined,
      expenses: d.expenses && d.expenses > 0 ? Math.round(d.expenses * 100) / 100 : undefined,
      currency: d.currency,
    });
    this.draft.set(null);
    this.platform.impact();
    void this.toast.show('Case saved. We’ll remind you before the deadline.', 'success');
  }

  async toggleResolved(c: LostCase) {
    await this.lf.save({ ...c, resolved: !c.resolved });
    if (!c.resolved) this.platform.success();
  }

  async remove(c: LostCase) {
    const a = await this.alerts.create({
      header: tr('Delete this case?'),
      buttons: [{ text: tr('Cancel'), role: 'cancel' }, { text: tr('Delete'), role: 'destructive' }],
    });
    await a.present();
    if ((await a.onDidDismiss()).role === 'destructive') await this.lf.remove(c.id);
  }

  day(iso: string) {
    return new Date(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
  }

  caseLine(c: LostCase) {
    return [c.flight, c.date ? this.day(c.date) : null, c.reference].filter(Boolean).join(' · ');
  }

  left(c: LostCase) {
    const d = deadline(c);
    if (!d) return null;
    const days = Math.ceil((d.at.getTime() - Date.now()) / 86_400_000);
    if (days < 0) return { days, text: d.lost ? tr('Claim as lost') : tr('Deadline passed') };
    return { days, text: days === 0 ? tr('Due today') : tr('{n} days left', { n: days }) };
  }

  letter(c: LostCase): string {
    const u = this.auth.user();
    const name = [u?.legalFirstName, u?.legalLastName].filter(Boolean).join(' ') || u?.name || '';
    const date = c.date ? new Date(c.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '[date]';
    const flight = c.flight ?? '[flight number]';
    const ref = c.reference ?? '[file reference]';
    const amount = c.expenses ? `${c.expenses.toFixed(2)} ${c.currency ?? 'EUR'}` : '[amount]';
    const received = c.receivedAt ? new Date(c.receivedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
    const lost = c.kind === 'delayed' && !c.receivedAt && Date.now() - new Date(c.date ?? c.createdAt).getTime() > 21 * 86_400_000;
    if (c.kind === 'plane' || c.kind === 'airport') {
      return [
        `To: ${c.airline ?? (c.kind === 'airport' ? 'Airport' : 'Airline')} Lost Property`,
        `Subject: Lost item${c.flight ? ` – flight ${flight}` : ''} on ${date}`,
        '',
        'Dear Lost Property team,',
        '',
        c.kind === 'plane'
          ? `I left an item on flight ${flight} on ${date}${c.airport ? `, arriving at ${c.airport}` : ''}.`
          : `I lost an item at ${c.airport ?? 'the airport'} on ${date}${c.flight ? ` before/after flight ${flight}` : ''}.`,
        '',
        `Item: ${c.item}`,
        c.details ? `Description: ${c.details}` : 'Description: [colour, brand, distinctive marks]',
        c.reference ? `Your reference: ${c.reference}` : '',
        '',
        `If it is found, please contact me at ${u?.email ?? '[e-mail]'}${u?.phone ? ` or ${u.phone}` : ''}. I can collect it or pay for delivery.`,
        '',
        'Thank you for your help.',
        '',
        'Kind regards,',
        name,
      ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
    }
    const what = c.kind === 'damaged'
      ? `my checked bag (${c.item}) was delivered${received ? ` on ${received}` : ''} damaged or with items missing`
      : lost
        ? `my checked bag (${c.item}) was not delivered and has still not been returned more than 21 days later`
        : `my checked bag (${c.item}) did not arrive with me${received ? ` and was only delivered on ${received}` : ''}`;
    const ask = c.kind === 'damaged'
      ? `I claim ${amount} for the repair or replacement, as shown in the attached quotes, receipts and photos.`
      : lost
        ? `I therefore consider the bag lost under Article 17(3) and claim compensation for its value and contents, ${amount}, as listed in the attachment.`
        : `While waiting I had to buy essential items for a total of ${amount}, as shown in the attached receipts, and I claim their refund.`;
    return [
      `To: ${c.airline ?? '[Airline]'} – Baggage claims`,
      `Subject: Baggage claim – file ${ref}, flight ${flight} on ${date}`,
      '',
      'Dear Sir or Madam,',
      '',
      `I travelled on flight ${flight} on ${date}. On arrival ${what}. I reported this at the airport under file reference ${ref}.`,
      '',
      ask,
      '',
      'Under the Montreal Convention (Articles 17, 19 and 22) the carrier is liable for the destruction, loss, damage and delay of checked baggage up to 1,519 Special Drawing Rights per passenger. This claim is made within the time limits of Article 31.',
      '',
      c.details ? `Bag and contents: ${c.details}` : '',
      `Attached: report ${ref}, boarding pass, bag tag, ${c.kind === 'damaged' ? 'photos, ' : ''}receipts.`,
      '',
      'Please pay the amount to: [IBAN / bank details]',
      '',
      'Kind regards,',
      name,
      u?.email ?? '',
    ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
  }

  mailto(c: LostCase) {
    const text = this.letter(c);
    const lines = text.split('\n');
    const subject = (lines.find((l) => l.startsWith('Subject: ')) ?? '').replace('Subject: ', '');
    const body = lines.filter((l) => !l.startsWith('To: ') && !l.startsWith('Subject: ')).join('\n').trim();
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async copy(c: LostCase) {
    try {
      await navigator.clipboard.writeText(this.letter(c));
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    } catch {
      return;
    }
  }

  async share(c: LostCase) {
    const text = this.letter(c);
    try {
      if (Capacitor.isNativePlatform()) await Share.share({ title: tr('Lost & Found'), text });
      else if (navigator.share) await navigator.share({ text });
      else await this.copy(c);
    } catch {
      return;
    }
  }
}
