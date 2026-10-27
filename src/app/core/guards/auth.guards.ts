import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { PrefsService } from '../services/prefs.service';

function whenAuthKnown() {
  const auth = inject(AuthService);
  return toObservable(auth.status).pipe(
    filter((s) => s !== 'unknown'),
    take(1),
  );
}

/** Signed-in area. */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  return whenAuthKnown().pipe(map((s) => (s === 'signed-in' ? true : router.parseUrl('/welcome'))));
};

/** Login / register screens: skip them when a session already exists. */
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  return whenAuthKnown().pipe(map((s) => (s === 'signed-in' ? router.parseUrl('/tabs/home') : true)));
};

/** Welcome screen is shown until the user has taken off once. */
export const welcomeGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const prefs = inject(PrefsService);
  const auth = inject(AuthService);
  await prefs.load();
  if (auth.status() === 'signed-in') return router.parseUrl('/tabs/home');
  return true;
};
