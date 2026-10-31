export interface AppEnvironment {
  production: boolean;
  useMocks: boolean;
  hashRouting: boolean;
  apiUrl: string;
  allowedApiOrigins: string[];
  auth: {
    appleEnabled: boolean;
    appleServiceId: string;
    appleRedirectUrl: string;
    googleWebClientId: string;
    googleIosClientId: string;
  };
  push: boolean;
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
