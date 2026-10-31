import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

@Injectable({ providedIn: 'root' })
export class ScoresService {
  readonly best = signal<Record<string, number>>({});
  private loaded = false;

  async load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const v = (await Preferences.get({ key: 'gm_scores' })).value;
      if (v) this.best.set(JSON.parse(v));
    } catch {
    }
  }

  submit(game: string, score: number, lowerIsBetter = false): boolean {
    const prev = this.best()[game];
    const better = prev === undefined || (lowerIsBetter ? score < prev : score > prev);
    if (better) {
      this.best.update((b) => ({ ...b, [game]: score }));
      Preferences.set({ key: 'gm_scores', value: JSON.stringify(this.best()) }).catch(() => {});
    }
    return better;
  }
}
