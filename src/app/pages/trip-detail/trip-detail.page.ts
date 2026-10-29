import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, OnInit, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonToolbar } from '@ionic/angular/standalone';
import { TravelStore } from '../../core/services/travel.store';
import { ToastService } from '../../core/services/toast.service';
import { PlatformService } from '../../core/services/platform.service';
import { BaggageAllowance, BagItem, Traveller, Trip, VerificationMethod } from '../../core/models';
import { CityImageComponent } from '../../shared/components/city-image.component';
import { InvitePanelComponent } from '../../shared/components/invite-panel.component';
import { DestinationGuideComponent } from '../../shared/components/destination-guide.component';
import { ConfettiService } from '../../shared/components/confetti.service';
import { ReviewService } from '../../core/services/review.service';
import { AchievementsService } from '../../core/services/achievements.service';
import { cleanText } from '../../core/security/sanitize';
import { BoardingPassComponent } from '../../shared/components/boarding-pass.component';
import { AvatarStackComponent } from '../../shared/components/avatar-stack.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { ProService } from '../../core/services/pro.service';
import { PressableDirective } from '../../shared/directives/pressable.directive';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { ClockPipe, DurationPipe, ShortDatePipe } from '../../shared/pipes/time.pipes';
import { FlightStatusPipe } from '../../shared/pipes/status.pipe';
import { AirportDayComponent } from '../../shared/components/airport-day.component';
import { LiveFlightComponent } from '../../shared/components/live-flight.component';
import { LiveFlightService } from '../../core/services/live-flight.service';
import { DestinationService } from '../../core/services/destination.service';
import { renderTripCard } from '../../core/utils/trip-card';
import { isShareCancel, shareCanvas } from '../../core/utils/share-image';

type Section = 'flights' | 'pass' | 'bags' | 'guide' | 'checklist' | 'expenses' | 'people';

@Component({
  selector: 'gm-trip-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonContent, IonHeader, IonToolbar, IonButtons, IonBackButton, IonIcon, RouterLink, FormsModule, DecimalPipe,
    BoardingPassComponent, AvatarStackComponent, CityImageComponent, InvitePanelComponent, DestinationGuideComponent, SkeletonComponent, AirportDayComponent, LiveFlightComponent, RevealDirective, PressableDirective, ClockPipe, DurationPipe, ShortDatePipe, FlightStatusPipe,
  ],
  templateUrl: './trip-detail.page.html',
  styleUrl: './trip-detail.page.scss',
})
export class TripDetailPage implements OnInit {
  protected pro = inject(ProService);
  readonly id = input.required<string>();
  /** Optional deep link to a section, e.g. ?tab=pass */
  readonly tab = input<Section | undefined>();

  private store = inject(TravelStore);
  private toast = inject(ToastService);
  private platform = inject(PlatformService);
  private confetti = inject(ConfettiService);
  private review = inject(ReviewService);
  private achievements = inject(AchievementsService);
  private dest = inject(DestinationService);
  readonly sharing = signal(false);

  readonly trip = computed<Trip | undefined>(() => this.store.trip(this.id()));
  readonly section = signal<Section>('flights');
  readonly sections: { id: Section; label: string; icon: string }[] = [
    { id: 'flights', label: 'Flights', icon: 'airplane' },
    { id: 'pass', label: 'Pass', icon: 'qr-code-outline' },
    { id: 'bags', label: 'Bags', icon: 'bag-handle-outline' },
    { id: 'guide', label: 'City guide', icon: 'compass-outline' },
    { id: 'checklist', label: 'Checklist', icon: 'checkmark-done' },
    { id: 'expenses', label: 'Expenses', icon: 'wallet-outline' },
    { id: 'people', label: 'People', icon: 'people-outline' },
  ];
  readonly scrollY = signal(0);

  readonly passIndex = signal(0);
  private live = inject(LiveFlightService);
  private clockTick = signal(Date.now());
  /** The trip's flight that is in the air or about to be (tracked live). */
  readonly liveFlight = computed(() => {
    const now = this.clockTick();
    return (this.trip()?.flights ?? []).find((f) => this.live.inWindow(f, now));
  });
  readonly upcomingFlights = computed(() => (this.trip()?.flights ?? []).filter((f) => new Date(f.arrival).getTime() > Date.now()));

  readonly checklistDone = computed(() => this.trip()?.checklist.filter((c) => c.done).length ?? 0);
  readonly checklistRatio = computed(() => {
    const total = this.trip()?.checklist.length ?? 0;
    return total ? this.checklistDone() / total : 0;
  });

  readonly totalSpent = computed(() => (this.trip()?.expenses ?? []).reduce((s, e) => s + e.amount, 0));
  /** Net balance per traveller: positive = is owed money. */
  readonly balances = computed(() => {
    const t = this.trip();
    if (!t) return [];
    const net = new Map<string, number>(t.travellers.map((p) => [p.id, 0]));
    for (const e of t.expenses) {
      const share = e.amount / e.splitWith.length;
      net.set(e.paidBy, (net.get(e.paidBy) ?? 0) + e.amount);
      for (const p of e.splitWith) net.set(p, (net.get(p) ?? 0) - share);
    }
    return t.travellers.map((p) => ({ person: p, amount: Math.round((net.get(p.id) ?? 0) * 100) / 100 }));
  });

  /** Fewest transfers that settle every balance (greedy: largest debtor pays largest creditor). Pro. */
  readonly settleUp = computed(() => {
    const debt = this.balances().filter((b) => b.amount < -0.004).map((b) => ({ p: b.person, v: -b.amount })).sort((a, b) => b.v - a.v);
    const cred = this.balances().filter((b) => b.amount > 0.004).map((b) => ({ p: b.person, v: b.amount })).sort((a, b) => b.v - a.v);
    const out: { from: Traveller; to: Traveller; amount: number }[] = [];
    let i = 0, j = 0;
    while (i < debt.length && j < cred.length) {
      const amt = Math.min(debt[i].v, cred[j].v);
      if (amt >= 0.01) out.push({ from: debt[i].p, to: cred[j].p, amount: Math.round(amt * 100) / 100 });
      debt[i].v -= amt;
      cred[j].v -= amt;
      if (debt[i].v < 0.005) i++;
      if (cred[j].v < 0.005) j++;
    }
    return out;
  });

  openSettleUp() {
    if (!this.pro.isPro()) {
      this.pro.open('expenses');
      return;
    }
    this.showSettle.update((v) => !v);
  }
  readonly showSettle = signal(false);

  /** CSV of all expenses (Pro). Shared via the system sheet on the phone, downloaded in a browser. */
  async exportCsv() {
    const t = this.trip();
    if (!t) return;
    if (!this.pro.isPro()) {
      this.pro.open('expenses');
      return;
    }
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [['Date', 'What', 'Amount', 'Currency', 'Paid by', 'Split between'].join(',')];
    for (const e of t.expenses) {
      rows.push([e.createdAt.slice(0, 10), q(e.label), e.amount.toFixed(2), e.currency, q(this.nameOf(e.paidBy)), q(e.splitWith.map((p) => this.nameOf(p)).join('; '))].join(','));
    }
    const csv = rows.join('\n');
    const name = `${t.title.replace(/[^\w-]+/g, '-').toLowerCase()}-expenses.csv`;
    if (this.platform.isNative) {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const { uri } = await Filesystem.writeFile({ path: name, data: csv, directory: Directory.Cache, encoding: Encoding.UTF8 });
      await Share.share({ title: name, url: uri }).catch(() => {});
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
  }

  private nameOf(id: string) {
    return id === 'me' ? 'You' : this.trip()?.travellers.find((p) => p.id === id)?.name ?? id;
  }

  // New expense form
  readonly addingExpense = signal(false);
  expenseLabel = '';
  expenseAmount: number | null = null;

  constructor() {
    effect(() => {
      if (this.trip()) untracked(() => this.checkFit());
    });
    const t = setInterval(() => this.clockTick.set(Date.now()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  ngOnInit(): void {
    void this.store.loadTrips();
    const t = this.tab();
    if (t && this.sections.some((s) => s.id === t)) this.section.set(t);
    this.checkFit();
  }

  onScroll(ev: CustomEvent) {
    this.scrollY.set((ev.detail as { scrollTop: number }).scrollTop);
  }

  select(s: Section) {
    this.platform.selection();
    this.section.set(s);
    if (s === 'guide') void this.achievements.track('guide_opened');
  }

  toggle(itemId: string) {
    this.platform.tap();
    const wasDone = this.trip()?.checklist.find((c) => c.id === itemId)?.done;
    void this.store.toggleChecklist(this.id(), itemId);
    if (!wasDone && this.checklistDone() === this.trip()?.checklist.length) {
      setTimeout(() => {
        this.platform.success();
        this.confetti.burst(0.5, 0.35);
        void this.review.positiveMoment();
        void this.achievements.track('checklist_complete');
      }, 150);
    }
  }

  methodLabel(m: VerificationMethod): string {
    return { airline: 'via airline', 'boarding-pass': 'via boarding pass', email: 'via airline email', manual: 'manual' }[m];
  }

  bagList(b: BaggageAllowance): { kind: 'personal' | 'cabin' | 'checked'; title: string; bag: BagItem | null }[] {
    return [
      { kind: 'personal', title: 'Personal item', bag: b.personalItem },
      { kind: 'cabin', title: 'Cabin bag', bag: b.cabinBag },
      { kind: 'checked', title: 'Checked bag', bag: b.checked[0] ?? null },
    ];
  }

  // Interactive "will it fit" checker against the next flight's allowance.
  fitL: number | null = 40;
  fitW: number | null = 30;
  fitH: number | null = 20;
  fitKg: number | null = 6;
  readonly fitResult = signal<{ ok: boolean; label: string; detail: string } | null>(null);

  checkFit() {
    const b = this.trip()?.flights.find((f) => f.baggage)?.baggage;
    const dims = [this.fitL, this.fitW, this.fitH].map((n) => Number(n) || 0).sort((a, z) => z - a);
    const kg = Number(this.fitKg) || 0;
    if (!b || dims.some((d) => d <= 0)) {
      this.fitResult.set(null);
      return;
    }
    const fits = (item: BagItem | null) => {
      if (!item) return false;
      const limit = [...item.dimensionsCm].sort((a, z) => z - a);
      const sizeOk = limit[1] ? dims.every((d, i) => d <= limit[i]) : dims.reduce((a, d) => a + d, 0) <= limit[0];
      return sizeOk && (!item.maxKg || kg <= item.maxKg);
    };
    const prev = this.fitResult()?.label;
    let res: { ok: boolean; label: string; detail: string };
    if (fits(b.personalItem)) res = { ok: true, label: 'Fits as your personal item', detail: 'Free — keep it under the seat in front of you.' };
    else if (fits(b.cabinBag)) res = { ok: true, label: 'Fits as your cabin bag', detail: 'Goes in the overhead locker.' };
    else if (b.checked.some((c) => fits(c))) res = { ok: true, label: 'Check it in', detail: 'Too big for the cabin, but within your checked allowance.' };
    else res = { ok: false, label: 'Too big for your fare', detail: 'Add a bag with your airline before the airport — it is cheaper online.' };
    if (prev && prev !== res.label) this.platform.selection();
    this.fitResult.set(res);
  }

  async saveExpense() {
    const t = this.trip();
    const label = cleanText(this.expenseLabel, 60);
    const amount = Number(this.expenseAmount);
    if (!t || !label || !Number.isFinite(amount) || amount <= 0 || amount > 100_000) {
      await this.toast.show('Enter a description and a valid amount.', 'error');
      return;
    }
    await this.store.addExpense(t.id, {
      label,
      amount: Math.round(amount * 100) / 100,
      currency: 'EUR',
      paidBy: 'me',
      splitWith: t.travellers.map((p) => p.id),
    });
    this.expenseLabel = '';
    this.expenseAmount = null;
    this.addingExpense.set(false);
    await this.toast.show('Expense added and split equally', 'success');
  }

  personName(id: string): string {
    return this.trip()?.travellers.find((p) => p.id === id)?.name.split(' ')[0] ?? 'Someone';
  }

  /** Story-sized countdown card ("12 days until Barcelona") for Instagram, WhatsApp… */
  async shareTrip(): Promise<void> {
    const t = this.trip();
    if (!t || this.sharing()) return;
    this.sharing.set(true);
    try {
      const photo = t.destination.imageUrl ?? (await this.dest.photo(t.destination.code).catch(() => undefined))?.url;
      const canvas = await renderTripCard(t, photo);
      await shareCanvas(canvas, `gatemate-${t.destination.city}.png`, `${t.destination.city}, here I come ✈️`);
      this.platform.success();
    } catch (e) {
      if (!isShareCancel(e)) void this.toast.show('Couldn’t create the image. Please try again.', 'error');
    } finally {
      this.sharing.set(false);
    }
  }
}
