import { AppEnvironment } from './environment.model';

/** Static web preview: mock data and hash routing so it works from any sub-path. */
export const environment: AppEnvironment = {
  production: true,
  useMocks: true,
  hashRouting: true,
  apiUrl: '/api/v1',
  allowedApiOrigins: [],
  auth: {
    appleServiceId: 'app.gatemate.signin',
    appleRedirectUrl: '',
    googleWebClientId: '',
    googleIosClientId: '',
  },
  security: {
    idleLockMinutes: 5,
    maxLoginAttemptsBeforeBackoff: 3,
  },
};
