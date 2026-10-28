export interface AppEnvironment {
  production: boolean;
  /** Serve data from the in-app mock API instead of the backend. */
  useMocks: boolean;
  hashRouting: boolean;
  apiUrl: string;
  /** Bearer tokens are only ever attached to requests for these origins. */
  allowedApiOrigins: string[];
  auth: {
    /** Turn on once the app has the Sign in with Apple capability (paid Apple Developer account). */
    appleEnabled: boolean;
    appleServiceId: string;
    appleRedirectUrl: string;
    googleWebClientId: string;
    googleIosClientId: string;
  };
  /** Satellite map tiles (Esri World Imagery in dev; use a keyed/licensed provider in production). */
  /** Remote push (APNs/FCM). Enable only once GoogleService-Info.plist / google-services.json are added. */
  push: boolean;
  /** RevenueCat public SDK keys (safe to ship). Empty = purchases unavailable in this build. */
  purchases: { iosApiKey: string; androidApiKey: string };
  maps: {
    satelliteTiles: string;
    labelTiles: string;
    attribution: string;
  };
  security: {
    idleLockMinutes: number;
    maxLoginAttemptsBeforeBackoff: number;
  };
}
