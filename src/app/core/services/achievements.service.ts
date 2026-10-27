import { computed, inject, Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { PlatformService } from './platform.service';

export type AchievementEvent =
  | 'app_open'
  | 'booking_verified'
  | 'trip_planned'
  | 'checklist_complete'
  | 'game_played'
  | 'memory_win'
  | 'quiz_perfect'
  | 'ttt_win'
  | 'dodge_25'
  | 'g2048_win'
  | 'flags_win'
  | 'hangman_win'
  | 'breathe_session'
  | 'stretch_done'
  | 'map_opened'
  | 'guide_opened'
  | 'invite_sent'
  | 'group_created'
  | 'profile_complete'
  | 'feedback_sent';

export interface BadgeDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  event: AchievementEvent;
  goal: number;
  xp: number;
  tier: 'bronze' | 'silver' | 'gold';
}

export interface BadgeView extends BadgeDef {
  progress: number;
  earned: boolean;
  earnedAt?: string;
}

export const BADGES: BadgeDef[] = [
  { id: 'first-boarding', title: 'First Boarding', description: 'Add and verify your first booking', icon: 'ticket', event: 'booking_verified', goal: 1, xp: 100, tier: 'bronze' },
  { id: 'frequent-flyer', title: 'Frequent Flyer', description: 'Verify 5 bookings', icon: 'airplane', event: 'booking_verified', goal: 5, xp: 300, tier: 'silver' },
  { id: 'jet-setter', title: 'Jet Setter', description: 'Verify 20 bookings', icon: 'rocket', event: 'booking_verified', goal: 20, xp: 1000, tier: 'gold' },
  { id: 'streak-3', title: 'On a Roll', description: 'Open Gatemate 3 days in a row', icon: 'flame', event: 'app_open', goal: 3, xp: 60, tier: 'bronze' },
  { id: 'streak-7', title: 'Weekly Cruiser', description: '7-day streak', icon: 'flame', event: 'app_open', goal: 7, xp: 150, tier: 'silver' },
  { id: 'streak-30', title: 'Always Ready', description: '30-day streak', icon: 'flame', event: 'app_open', goal: 30, xp: 600, tier: 'gold' },
  { id: 'packed', title: 'Packed & Ready', description: 'Finish a trip checklist', icon: 'checkmark-done', event: 'checklist_complete', goal: 1, xp: 80, tier: 'bronze' },
  { id: 'organiser', title: 'Trip Organiser', description: 'Create a trip group', icon: 'people', event: 'group_created', goal: 1, xp: 80, tier: 'bronze' },
  { id: 'squad', title: 'Squad Goals', description: 'Send 3 invites to friends', icon: 'paper-plane', event: 'invite_sent', goal: 3, xp: 150, tier: 'silver' },
  { id: 'navigator', title: 'Navigator', description: 'Open the satellite airport map 3 times', icon: 'map', event: 'map_opened', goal: 3, xp: 60, tier: 'bronze' },
  { id: 'explorer', title: 'Explorer', description: 'Read 5 city guides', icon: 'compass', event: 'guide_opened', goal: 5, xp: 120, tier: 'silver' },
  { id: 'player', title: 'Cabin Gamer', description: 'Play 10 in-flight games', icon: 'game-controller', event: 'game_played', goal: 10, xp: 100, tier: 'bronze' },
  { id: 'memory', title: 'Photographic', description: 'Win Boarding Memory', icon: 'albums', event: 'memory_win', goal: 1, xp: 60, tier: 'bronze' },
  { id: 'quiz', title: 'Code Master', description: 'Get a perfect Code Quiz', icon: 'school', event: 'quiz_perfect', goal: 1, xp: 150, tier: 'gold' },
  { id: 'ttt', title: 'Autopilot Beater', description: 'Win 5 games of Planes & Clouds', icon: 'trophy', event: 'ttt_win', goal: 5, xp: 120, tier: 'silver' },
  { id: 'dodge', title: 'Storm Chaser', description: 'Score 25 in Sky Dodge', icon: 'thunderstorm', event: 'dodge_25', goal: 1, xp: 150, tier: 'silver' },
  { id: '2048', title: 'Cruising Altitude', description: 'Reach 2048', icon: 'trending-up', event: 'g2048_win', goal: 1, xp: 300, tier: 'gold' },
  { id: 'flags', title: 'Flag Spotter', description: 'Score 8+ in Flag Quiz', icon: 'flag', event: 'flags_win', goal: 1, xp: 100, tier: 'silver' },
  { id: 'hangman', title: 'City Sleuth', description: 'Guess 5 cities', icon: 'search', event: 'hangman_win', goal: 5, xp: 120, tier: 'silver' },
  { id: 'zen', title: 'Zen Flyer', description: 'Complete 3 breathing sessions', icon: 'leaf', event: 'breathe_session', goal: 3, xp: 80, tier: 'bronze' },
  { id: 'stretch', title: 'Leg Day at 35,000 ft', description: 'Finish the seat stretches', icon: 'body', event: 'stretch_done', goal: 1, xp: 80, tier: 'bronze' },
  { id: 'profile', title: 'All Set', description: 'Complete your profile', icon: 'person-circle', event: 'profile_complete', goal: 1, xp: 50, tier: 'bronze' },
  { id: 'voice', title: 'Co-pilot', description: 'Send feedback to the team', icon: 'chatbox-ellipses', event: 'feedback_sent', goal: 1, xp: 50, tier: 'bronze' },
];

export const LEVELS = [
  { name: 'Passenger', xp: 0 },
  { name: 'Frequent Flyer', xp: 200 },
  { name: 'Silver', xp: 600 },
  { name: 'Gold', xp: 1400 },
  { name: 'Platinum', xp: 2800 },
  { name: 'Captain', xp: 5000 },
];

interface State {
  counters: Partial<Record<AchievementEvent, number>>;
  earned: Record<string, string>;
  streak: number;
  lastDay: string;
}

const KEY = 'gm_achievements';

/**
 * Badges, XP levels and a daily streak — all earned from real actions in the app (no purchases,
 * no random rewards). Stored on the device; synced to the account by the backend when available.
 */
@Injectable({ providedIn: 'root' })
export class AchievementsService {
  private platform = inject(PlatformService);
  private state = signal<State>({ counters: {}, earned: {}, streak: 0, lastDay: '' });
  private loaded: Promise<void> | null = null;

  /** Queue of newly unlocked badges, shown one by one by the badge toast. */
  readonly unlocked = signal<BadgeView[]>([]);

  readonly badges = computed<BadgeView[]>(() => {
    const s = this.state();
    return BADGES.map((b) => {
      const value = b.event === 'app_open' ? s.streak : s.counters[b.event] ?? 0;
      return { ...b, progress: Math.min(1, value / b.goal), earned: !!s.earned[b.id], earnedAt: s.earned[b.id] };
    });
  });
  readonly xp = computed(() => this.badges().filter((b) => b.earned).reduce((n, b) => n + b.xp, 0));
  readonly level = computed(() => {
    const xp = this.xp();
    let i = 0;
    while (i < LEVELS.length - 1 && xp >= LEVELS[i + 1].xp) i++;
    const cur = LEVELS[i], next = LEVELS[i + 1];
    return { index: i + 1, name: cur.name, next: next?.name, progress: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1, toNext: next ? next.xp - xp : 0 };
  });
  readonly streak = computed(() => this.state().streak);
  readonly earnedCount = computed(() => this.badges().filter((b) => b.earned).length);

  load(): Promise<void> {
    this.loaded ??= (async () => {
      try {
        const v = (await Preferences.get({ key: KEY })).value;
        if (v) this.state.set({ counters: {}, earned: {}, streak: 0, lastDay: '', ...JSON.parse(v) });
      } catch {
        /* first run */
      }
    })();
    return this.loaded;
  }

  /** Daily streak: consecutive calendar days with the app opened. */
  async openedToday(): Promise<void> {
    await this.load();
    const today = new Date().toISOString().slice(0, 10);
    const s = this.state();
    if (s.lastDay === today) return;
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    this.state.set({ ...s, streak: s.lastDay === yesterday ? s.streak + 1 : 1, lastDay: today });
    this.evaluate();
  }

  async track(event: AchievementEvent, by = 1): Promise<void> {
    await this.load();
    const s = this.state();
    this.state.set({ ...s, counters: { ...s.counters, [event]: (s.counters[event] ?? 0) + by } });
    this.evaluate();
  }

  dismiss() {
    this.unlocked.update((q) => q.slice(1));
  }

  private evaluate() {
    const s = this.state();
    const fresh = this.badges().filter((b) => !b.earned && b.progress >= 1);
    if (fresh.length) {
      const now = new Date().toISOString();
      const earned = { ...s.earned };
      fresh.forEach((b) => (earned[b.id] = now));
      this.state.set({ ...s, earned });
      this.unlocked.update((q) => [...q, ...fresh.map((b) => ({ ...b, earned: true, earnedAt: now }))]);
      this.platform.success();
    }
    Preferences.set({ key: KEY, value: JSON.stringify(this.state()) }).catch(() => {});
  }
}
