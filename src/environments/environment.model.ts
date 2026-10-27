export interface AppEnvironment {
  production: boolean;
  /** Serve data from the in-app mock API instead of the backend. */
  useMocks: boolean;
  hashRouting: boolean;
  apiUrl: string;
  /** Bearer tokens are only ever attached to requests for these origins. */
  allowedApiOrigins: string[];
  auth: {
    appleServiceId: string;
    appleRedirectUrl: string;
    googleWebClientId: string;
    googleIosClientId: string;
  };
  security: {
    idleLockMinutes: number;
    maxLoginAttemptsBeforeBackoff: number;
  };
}
