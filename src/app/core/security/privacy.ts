import { PrivacyScreen } from '@capacitor/privacy-screen';

export function privacyOn(): Promise<unknown> {
  return PrivacyScreen.enable({
    android: { preventScreenshots: false, privacyModeOnActivityHidden: 'splash' },
    ios: { blurEffect: 'light' },
  }).catch(() => {});
}

export function privacyOff(): Promise<unknown> {
  return PrivacyScreen.disable().catch(() => {});
}
