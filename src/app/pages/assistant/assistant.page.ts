import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonBackButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { t as tr, TranslatePipe } from '../../core/i18n/i18n.service';
import { AuthService } from '../../core/services/auth.service';
import { PlatformService } from '../../core/services/platform.service';
import { TravelStore } from '../../core/services/travel.store';
import { VELO_STEPS, VeloService } from '../../core/services/velo.service';
import { RichTextPipe } from '../../shared/pipes/rich-text.pipe';

/** One-tap jobs Velo does end to end with the traveller's real trips. */
const AUTOMATIONS = [
  { icon: 'sparkles', color: '#8B5CF6', title: 'Prepare my next trip', prompt: 'Prepare my next trip: check my flights and the destination, then add what I need to my checklist.' },
  { icon: 'time-outline', color: '#0FB5C3', title: 'Plan my airport day', prompt: 'Plan my airport day for my next flight: when to leave, check-in, security and boarding, with times.' },
  { icon: 'compass-outline', color: '#F97316', title: 'Destination briefing', prompt: 'Give me a short briefing on my next destination: money, plugs, transport, customs and public holidays during my trip.' },
  { icon: 'scale-outline', color: '#EF4444', title: 'My flight is delayed', prompt: 'My flight is delayed. What are my rights and what should I do now?' },
  { icon: 'shield-checkmark-outline', color: '#10B981', title: 'Documents & entry rules', prompt: 'What documents do I need for my next trip? Check the latest official entry rules.' },
  { icon: 'bag-handle-outline', color: '#0EA5E9', title: 'What to pack', prompt: 'What should I pack for my next trip, given the weather and my baggage allowance?' },
];

@Component({
  selector: 'gm-assistant',
  templateUrl: './assistant.page.html',
  styleUrl: './assistant.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RichTextPipe, FormsModule, RouterLink, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent, IonFooter, IonIcon],
})
export class AssistantPage implements OnInit {
  readonly velo = inject(VeloService);
  private auth = inject(AuthService);
  private store = inject(TravelStore);
  private route = inject(ActivatedRoute);
  private platform = inject(PlatformService);
  private content = viewChild(IonContent);
  private input = viewChild<ElementRef<HTMLTextAreaElement>>('input');

  readonly automations = AUTOMATIONS;
  readonly steps = VELO_STEPS;
  readonly draft = signal('');
  readonly firstName = computed(() => this.auth.user()?.name.split(/\s+/)[0] ?? '');
  readonly status = this.velo.status;
  readonly left = computed(() => {
    const s = this.status();
    return s ? Math.max(0, s.limit - s.used) : null;
  });
  readonly off = computed(() => this.status()?.enabled === false);

  constructor() {
    // Follow the answer as it streams in.
    effect(() => {
      this.velo.messages();
      queueMicrotask(() => void this.content()?.scrollToBottom(200));
    });
  }

  ngOnInit(): void {
    void this.velo.loadStatus();
    if (!this.store.trips().length) void this.store.loadTrips();
    const q = this.route.snapshot.queryParamMap;
    const trip = q.get('trip') ? this.store.trips().find((x) => x.id === q.get('trip')) : undefined;
    const prompt = q.get('prompt');
    if (prompt) {
      this.velo.reset();
      void this.velo.send(trip ? `${tr(prompt)} (${trip.title})` : tr(prompt));
    }
  }

  run(prompt: string): void {
    this.platform.tap();
    void this.velo.send(tr(prompt));
  }

  send(): void {
    const text = this.draft().trim();
    if (!text || this.velo.busy()) return;
    this.platform.tap();
    this.draft.set('');
    void this.velo.send(text);
  }

  onKey(ev: KeyboardEvent): void {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      this.send();
    }
  }

  newChat(): void {
    this.platform.tap();
    this.velo.reset();
    this.input()?.nativeElement.focus();
  }

  stepLabel(name: string): string {
    return this.steps[name]?.label ?? 'Working on it';
  }

  stepIcon(name: string): string {
    return this.steps[name]?.icon ?? 'sparkles';
  }

  /** Links in answers open in the browser, never inside the app. */
  openLink(ev: MouseEvent): void {
    const a = (ev.target as HTMLElement).closest('a');
    if (!a) return;
    ev.preventDefault();
    if (/^https:\/\//.test(a.href)) window.open(a.href, '_blank', 'noopener');
  }

  open(url: string): void {
    window.open(url, '_blank', 'noopener');
  }

  host(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }
}
