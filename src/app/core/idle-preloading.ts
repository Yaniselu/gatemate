import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of, switchMap, timer } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class IdlePreloading implements PreloadingStrategy {
  private ready = new Observable<void>((sub) => {
    const done = () => {
      sub.next();
      sub.complete();
    };
    const idle = (globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(done, { timeout: 5000 });
    else setTimeout(done, 1500);
  });

  preload(_route: Route, load: () => Observable<unknown>): Observable<unknown> {
    return timer(2500).pipe(switchMap(() => this.ready), switchMap(() => load() ?? of(null)));
  }
}
