import { inject, Injectable, signal } from '@angular/core';
import { MOCK_REPLIES, TRAVELLERS } from '../data/mock-data';
import { ChatMessage, ChatThread } from '../models';
import { randomId } from '../security/crypto.util';
import { cleanText, maskProfanity } from '../security/sanitize';
import { environment } from '../../../environments/environment';
import { GatemateApi } from './api';
import { LoadState } from './travel.store';

const SEND_WINDOW_MS = 10_000;
const MAX_MESSAGES_PER_WINDOW = 8;

@Injectable({ providedIn: 'root' })
export class ChatService {
  private api = inject(GatemateApi);
  private sentAt: number[] = [];

  readonly threads = signal<ChatThread[]>([]);
  readonly threadsState = signal<LoadState>('idle');
  readonly messages = signal<Record<string, ChatMessage[]>>({});
  readonly typing = signal<Record<string, string | null>>({});

  async loadThreads(force = false): Promise<void> {
    if (!force && this.threadsState() === 'ready') return;
    if (!force) this.threadsState.set('loading');
    try {
      this.threads.set(await this.api.getThreads());
      this.threadsState.set('ready');
    } catch {
      this.threadsState.set('error');
    }
  }

  thread(id: string): ChatThread | undefined {
    return this.threads().find((t) => t.id === id);
  }

  async loadMessages(threadId: string): Promise<void> {
    const list = await this.api.getMessages(threadId);
    this.messages.update((m) => ({ ...m, [threadId]: list }));
    this.threads.update((ts) => ts.map((t) => (t.id === threadId ? { ...t, unread: 0 } : t)));
  }

  /** Validates, filters and rate-limits locally, then sends optimistically. */
  async send(threadId: string, raw: string, authorName: string): Promise<{ ok: boolean; reason?: string }> {
    const text = cleanText(raw);
    if (!text) return { ok: false };
    const now = Date.now();
    this.sentAt = this.sentAt.filter((t) => now - t < SEND_WINDOW_MS);
    if (this.sentAt.length >= MAX_MESSAGES_PER_WINDOW) return { ok: false, reason: 'You are sending messages too quickly. Take a breath ✈️' };
    this.sentAt.push(now);

    const { text: safe, flagged } = maskProfanity(text);
    const clientId = randomId('msg_');
    const pending: ChatMessage = { id: clientId, threadId, authorId: 'me', authorName, text: safe, createdAt: new Date().toISOString(), status: 'sending', flagged };
    this.append(threadId, pending);

    try {
      const saved = await this.api.sendMessage(threadId, safe, clientId);
      this.replace(threadId, clientId, { ...saved, flagged });
      this.threads.update((ts) => ts.map((t) => (t.id === threadId ? { ...t, lastMessage: saved } : t)));
      if (environment.useMocks) this.simulateReply(threadId);
      return { ok: true };
    } catch {
      this.replace(threadId, clientId, { ...pending, status: 'failed' });
      return { ok: false, reason: 'Message not sent. Tap to retry.' };
    }
  }

  async retry(threadId: string, message: ChatMessage, authorName: string): Promise<void> {
    this.messages.update((m) => ({ ...m, [threadId]: (m[threadId] ?? []).filter((x) => x.id !== message.id) }));
    await this.send(threadId, message.text, authorName);
  }

  report(messageId: string, reason: string): Promise<void> {
    return this.api.reportMessage(messageId, reason);
  }

  async block(threadId: string, userId: string): Promise<void> {
    await this.api.blockUser(userId);
    this.messages.update((m) => ({ ...m, [threadId]: (m[threadId] ?? []).filter((x) => x.authorId !== userId) }));
  }

  async leave(threadId: string): Promise<void> {
    await this.api.leaveThread(threadId);
    this.threads.update((ts) => ts.filter((t) => t.id !== threadId));
  }

  toggleMute(threadId: string): void {
    this.threads.update((ts) => ts.map((t) => (t.id === threadId ? { ...t, muted: !t.muted } : t)));
  }

  reset(): void {
    this.threads.set([]);
    this.threadsState.set('idle');
    this.messages.set({});
  }

  private append(threadId: string, msg: ChatMessage) {
    this.messages.update((m) => ({ ...m, [threadId]: [...(m[threadId] ?? []), msg] }));
  }

  private replace(threadId: string, id: string, msg: ChatMessage) {
    this.messages.update((m) => ({ ...m, [threadId]: (m[threadId] ?? []).map((x) => (x.id === id ? msg : x)) }));
  }

  private simulateReply(threadId: string) {
    const thread = this.thread(threadId);
    const others = (thread?.members ?? TRAVELLERS).filter((t) => t.id !== 'me');
    const author = others[Math.floor(Math.random() * others.length)];
    if (!author) return;
    setTimeout(() => this.typing.update((t) => ({ ...t, [threadId]: author.name.split(' ')[0] })), 900);
    setTimeout(() => {
      this.typing.update((t) => ({ ...t, [threadId]: null }));
      this.append(threadId, {
        id: randomId('msg_'),
        threadId,
        authorId: author.id,
        authorName: author.name,
        text: MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)],
        createdAt: new Date().toISOString(),
        status: 'sent',
      });
    }, 2800);
  }
}
