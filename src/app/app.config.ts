import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, RouteReuseStrategy, withComponentInputBinding, withHashLocation, withPreloading } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { environment } from '../environments/environment';
import { I18nService } from './core/i18n/i18n.service';
import { routes } from './app.routes';
import { GatemateApi } from './core/services/api';
import { MockApi } from './core/services/mock-api';
import { HttpApi } from './core/services/http-api';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';
import { PrefsService } from './core/services/prefs.service';
import { AppLockService } from './core/security/app-lock.service';
import { PlatformService } from './core/services/platform.service';
import { ReviewService } from './core/services/review.service';
import { AchievementsService } from './core/services/achievements.service';
import { gatemateNavAnimation } from './shared/animations/page-transition';
import { registerIcons } from './icons';
import { IdlePreloading } from './core/idle-preloading';
import { ServerWarmupService } from './core/services/server-warmup.service';

registerIcons();

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular({ mode: 'ios', navAnimation: gatemateNavAnimation, innerHTMLTemplatesEnabled: false, sanitizerEnabled: true }),
    provideRouter(routes, withPreloading(IdlePreloading), withComponentInputBinding(), ...(environment.hashRouting ? [withHashLocation()] : [])),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: GatemateApi, useClass: environment.useMocks ? MockApi : HttpApi },
    provideAppInitializer(async () => {
      inject(ServerWarmupService).start();
      const prefs = inject(PrefsService);
      const i18n = inject(I18nService);
      const auth = inject(AuthService);
      const lock = inject(AppLockService);
      const platform = inject(PlatformService);
      void inject(ReviewService).init();
      const achievements = inject(AchievementsService);
      await Promise.all([prefs.load(), i18n.init()]);
      await auth.init();
      await lock.init();
      lock.lockIfEnabled();
      if (auth.status() === 'signed-in') void achievements.openedToday();
      if (platform.isNative) {
        StatusBar.setStyle({ style: Style.Light }).catch(() => {});
        SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {});
      }
    }),
  ],
};
