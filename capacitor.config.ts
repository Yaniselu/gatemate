import type { CapacitorConfig } from '@capacitor/cli';

const isProd = process.env['NODE_ENV'] === 'production';

const config: CapacitorConfig = {
  appId: 'app.gatemate',
  appName: 'Gatemate',
  webDir: 'www',
  // Never log bridge traffic (it can contain tokens) in release builds.
  loggingBehavior: isProd ? 'none' : 'debug',
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
    // Only allow in-app navigation to our own domains.
    allowNavigation: [],
  },
  ios: {
    contentInset: 'never',
    limitsNavigationsToAppBoundDomains: true,
    webContentsDebuggingEnabled: !isProd,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: !isProd,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: false,
      backgroundColor: '#0FB5C3',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      overlaysWebView: true,
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
    LocalNotifications: {
      iconColor: '#0FB5C3',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
