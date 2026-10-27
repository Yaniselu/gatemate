import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { PreloadAllModules, provideRouter, RouteReuseStrategy, withComponentInputBinding, withHashLocation, withPreloading } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { GatemateApi } from './core/services/api';
import { MockApi } from './core/services/mock-api';
import { HttpApi } from './core/services/http-api';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';
import { PrefsService } from './core/services/prefs.service';
import { AppLockService } from './core/security/app-lock.service';
import { PlatformService } from './core/services/platform.service';
import { gatemateNavAnimation } from './shared/animations/page-transition';
import { registerIcons } from './icons';

registerIcons();

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular({ mode: 'ios', navAnimation: gatemateNavAnimation, innerHTMLTemplatesEnabled: false, sanitizerEnabled: true }),
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding(), ...(environment.hashRouting ? [withHashLocation()] : [])),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: GatemateApi, useClass: environment.useMocks ? MockApi : HttpApi },
    provideAppInitializer(async () => {
      const prefs = inject(PrefsService);
      const auth = inject(AuthService);
      const lock = inject(AppLockService);
      const platform = inject(PlatformService);
      await prefs.load();
      await auth.init();
      await lock.init();
      lock.lockIfEnabled();
      if (platform.isNative) {
        StatusBar.setStyle({ style: Style.Light }).catch(() => {});
        SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {});
      }
    }),
  ],
};
