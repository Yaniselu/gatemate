import { Injectable } from '@angular/core';

const KEY = 'gm_lite';

@Injectable({ providedIn: 'root' })
export class PerformanceService {
  lite = false;

  start() {
    const root = document.documentElement;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      saved = null;
    }
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const weak = (nav.deviceMemory !== undefined && nav.deviceMemory <= 3) || (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 3) || !!nav.connection?.saveData;
    const transparency = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-transparency: reduce)').matches;
    this.apply(saved === '1' || weak || transparency);
    if (saved === null && !this.lite) setTimeout(() => this.probe(), 2500);
  }

  private apply(on: boolean) {
    this.lite = on;
    document.documentElement.classList.toggle('gm-lite', on);
  }

  private probe() {
    const frames: number[] = [];
    let last = performance.now();
    const tick = (now: number) => {
      frames.push(now - last);
      last = now;
      if (frames.length < 90) {
        requestAnimationFrame(tick);
        return;
      }
      const sorted = frames.slice(5).sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const slow = sorted.filter((f) => f > 34).length / sorted.length;
      const lite = median > 24 || slow > 0.25;
      try {
        localStorage.setItem(KEY, lite ? '1' : '0');
      } catch {
        void 0;
      }
      if (lite) this.apply(true);
    };
    requestAnimationFrame(tick);
  }
}
