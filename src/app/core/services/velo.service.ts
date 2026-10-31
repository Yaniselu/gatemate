import { inject, Injectable, signal } from '@angular/core';
import { t } from '../i18n/i18n.service';
import { ApiError, AssistantEvent, AssistantStatus, GatemateApi } from './api';
import { TravelStore } from './travel.store';

export interface VeloStep {
  id: string;
  name: string;
  state: 'running' | 'done' | 'failed';
}

export interface VeloMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  steps: VeloStep[];
  sources: { title: string; url: string }[];
  actions: { tripId: string; added: string[] }[];
  streaming?: boolean;
  slow?: boolean;
  error?: string;
}

export const VELO_STEPS: Record<string, { icon: string; label: string }> = {
  get_my_trips: { icon: 'airplane-outline', label: 'Checking your trips' },
  get_flight: { icon: 'time-outline', label: 'Checking your flight' },
  find_airport: { icon: 'business-outline', label: 'Looking up the airport' },
  get_destination_guide: { icon: 'compass-outline', label: 'Reading the destination guide' },
  convert_currency: { icon: 'cash-outline', label: 'Converting currency' },
  estimate_compensation: { icon: 'scale-outline', label: 'Checking your rights' },
  add_checklist_items: { icon: 'checkbox-outline', label: 'Adding to your checklist' },
  web_search: { icon: 'globe-outline', label: 'Searching the web' },
};

@Injectable({ providedIn: 'root' })
export class VeloService {
  private api = inject(GatemateApi);
  private store = inject(TravelStore);

  readonly messages = signal<VeloMessage[]>([]);
  readonly busy = signal(false);
  readonly status = signal<AssistantStatus | null>(null);
  private abort: AbortController | null = null;
  private nextId = 1;

  async loadStatus(): Promise<void> {
    try {
      this.status.set(await this.api.assistantStatus());
    } catch {
      this.status.set(null);
    }
  }

  reset(): void {
    this.stop();
    this.messages.set([]);
  }

  stop(): void {
    this.abort?.abort();
    this.abort = null;
    this.busy.set(false);
    this.messages.update((list) => list.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
  }

  async send(text: string): Promise<void> {
    const q = text.trim().slice(0, 4000);
    if (!q || this.busy()) return;
    const user: VeloMessage = { id: this.nextId++, role: 'user', text: q, steps: [], sources: [], actions: [] };
    const reply: VeloMessage = { id: this.nextId++, role: 'assistant', text: '', steps: [], sources: [], actions: [], streaming: true };
    const history = [...this.messages().filter((m) => !m.error && m.text), user].slice(-30).map((m) => ({ role: m.role, text: m.text }));
    this.messages.update((list) => [...list, user, reply]);
    this.busy.set(true);
    const abort = (this.abort = new AbortController());
    const patch = (fn: (m: VeloMessage) => VeloMessage) => this.messages.update((list) => list.map((m) => (m.id === reply.id ? fn(m) : m)));

    let heard = false;
    const slowTimer = setTimeout(() => !heard && patch((m) => ({ ...m, slow: true })), 6000);
    try {
      await this.api.assistantChat(history, (e) => {
        if (!heard) {
          heard = true;
          patch((m) => ({ ...m, slow: false }));
        }
        this.apply(e, patch);
      }, abort.signal);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t('Velo is unavailable right now. Try again in a moment.');
      patch((m) => ({ ...m, error: msg }));
    } finally {
      clearTimeout(slowTimer);
      if (this.abort === abort) this.abort = null;
      patch((m) => ({ ...m, streaming: false, slow: false, error: m.error ?? (!m.text && !abort.signal.aborted ? t('Velo is unavailable right now. Try again in a moment.') : undefined) }));
      this.busy.set(false);
      void this.loadStatus();
    }
  }

  private apply(e: AssistantEvent, patch: (fn: (m: VeloMessage) => VeloMessage) => void): void {
    switch (e.type) {
      case 'delta':
        patch((m) => ({ ...m, text: m.text + e.text }));
        break;
      case 'tool':
        patch((m) => ({ ...m, steps: m.steps.some((s) => s.id === e.id) ? m.steps : [...m.steps, { id: e.id, name: e.name, state: 'running' }] }));
        break;
      case 'tool_done':
        patch((m) => ({ ...m, steps: m.steps.map((s) => (s.id === e.id ? { ...s, state: e.ok ? 'done' : 'failed' } : s)) }));
        break;
      case 'action':
        patch((m) => ({ ...m, actions: [...m.actions, { tripId: e.tripId, added: e.added }] }));
        void this.store.loadTrips(true);
        break;
      case 'sources':
        patch((m) => ({ ...m, sources: [...m.sources, ...e.items.filter((s) => /^https:\/\//.test(s.url) && !m.sources.some((x) => x.url === s.url))].slice(0, 6) }));
        break;
      case 'truncated':
        patch((m) => ({ ...m, text: m.text + '…' }));
        break;
      case 'error':
        patch((m) => ({ ...m, error: ERRORS[e.message] ? t(ERRORS[e.message]) : t(e.message) }));
        break;
      case 'done':
        patch((m) => ({ ...m, steps: m.steps.map((s) => (s.state === 'running' ? { ...s, state: 'done' } : s)) }));
        break;
    }
  }
}

const ERRORS: Record<string, string> = {
  busy: 'Velo is very busy right now. Try again in a minute.',
  refused: 'Velo can’t help with that. Ask something about your travel.',
  unavailable: 'Velo is unavailable right now. Try again in a moment.',
};
