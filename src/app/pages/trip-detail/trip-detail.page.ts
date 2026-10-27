import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonToolbar } from '@ionic/angular/standalone';
import { TravelStore } from '../../core/services/travel.store';
import { ToastService } from '../../core/services/toast.service';
import { PlatformService } from '../../core/services/platform.service';
import { Trip } from '../../core/models';
import { cleanText } from '../../core/security/sanitize';
import { BoardingPassComponent } from '../../shared/components/boarding-pass.component';
import { AvatarStackComponent } from '../../shared/components/avatar-stack.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { ClockPipe, DurationPipe, ShortDatePipe } from '../../shared/pipes/time.pipes';
import { FlightStatusPipe } from '../../shared/pipes/status.pipe';

type Section = 'flights' | 'pass' | 'checklist' | 'expenses' | 'people';

@Component({
  selector: 'gm-trip-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonContent, IonHeader, IonToolbar, IonButtons, IonBackButton, IonIcon, RouterLink, FormsModule, DecimalPipe,
    BoardingPassComponent, AvatarStackComponent, SkeletonComponent, RevealDirective, ClockPipe, DurationPipe, ShortDatePipe, FlightStatusPipe,
  ],
  templateUrl: './trip-detail.page.html',
  styleUrl: './trip-detail.page.scss',
})
export class TripDetailPage implements OnInit {
  readonly id = input.required<string>();
  /** Optional deep link to a section, e.g. ?tab=pass */
  readonly tab = input<Section | undefined>();

  private store = inject(TravelStore);
  private toast = inject(ToastService);
  private platform = inject(PlatformService);

  readonly trip = computed<Trip | undefined>(() => this.store.trip(this.id()));
  readonly section = signal<Section>('flights');
  readonly sections: { id: Section; label: string; icon: string }[] = [
    { id: 'flights', label: 'Flights', icon: 'airplane' },
    { id: 'pass', label: 'Pass', icon: 'qr-code-outline' },
    { id: 'checklist', label: 'Checklist', icon: 'checkmark-done' },
    { id: 'expenses', label: 'Expenses', icon: 'wallet-outline' },
    { id: 'people', label: 'People', icon: 'people-outline' },
  ];
  readonly scrollY = signal(0);

  readonly passIndex = signal(0);
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

  // New expense form
  readonly addingExpense = signal(false);
  expenseLabel = '';
  expenseAmount: number | null = null;

  ngOnInit(): void {
    void this.store.loadTrips();
    const t = this.tab();
    if (t && this.sections.some((s) => s.id === t)) this.section.set(t);
  }

  onScroll(ev: CustomEvent) {
    this.scrollY.set((ev.detail as { scrollTop: number }).scrollTop);
  }

  select(s: Section) {
    this.platform.selection();
    this.section.set(s);
  }

  toggle(itemId: string) {
    this.platform.tap();
    void this.store.toggleChecklist(this.id(), itemId);
    if (this.checklistDone() + 1 === this.trip()?.checklist.length) setTimeout(() => this.platform.success(), 200);
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

  async invite() {
    const t = this.trip();
    if (!t) return;
    // Invite links are single-use tokens issued by the backend; this is the front-end placeholder.
    const text = `Join "${t.title}" on Gatemate ✈️`;
    try {
      if (navigator.share) await navigator.share({ title: 'Gatemate', text });
      else {
        await navigator.clipboard.writeText(text);
        await this.toast.show('Invite copied to clipboard', 'success');
      }
    } catch {
      /* share sheet dismissed */
    }
  }

  personName(id: string): string {
    return this.trip()?.travellers.find((p) => p.id === id)?.name.split(' ')[0] ?? 'Someone';
  }
}
