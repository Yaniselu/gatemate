import type { CapacitorConfig } from '@capacitor/cli';

const isProd = process.env['NODE_ENV'] === 'production';

const config: CapacitorConfig = {
  appId: 'com.velosyntech.gatemate',
  appName: 'Gatemate',
  webDir: 'www',
  loggingBehavior: isProd ? 'none' : 'debug',
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
    allowNavigation: [],
  },
  ios: {
    contentInset: 'never',
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
      backgroundColor: '#FFFFFF',
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
