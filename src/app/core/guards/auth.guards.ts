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

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  return whenAuthKnown().pipe(map((s) => (s === 'signed-in' ? true : router.parseUrl('/welcome'))));
};

export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  return whenAuthKnown().pipe(map((s) => (s === 'signed-in' ? router.parseUrl('/tabs/home') : true)));
};

export const welcomeGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const prefs = inject(PrefsService);
  const auth = inject(AuthService);
  await prefs.load();
  if (auth.status() === 'signed-in') return router.parseUrl('/tabs/home');
  return true;
};

export const PENDING_INVITE = 'gm_pending_invite';
export const inviteGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  return whenAuthKnown().pipe(
    map((s) => {
      if (s === 'signed-in') return true;
      try {
        sessionStorage.setItem(PENDING_INVITE, route.paramMap.get('token') ?? '');
      } catch {
      }
      return router.parseUrl('/welcome');
    }),
  );
};
