import { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: true,
  useMocks: false,
  hashRouting: false,
  apiUrl: 'https://api.gatemate.app/api/v1',
  allowedApiOrigins: ['https://api.gatemate.app'],
  auth: {
    appleServiceId: 'app.gatemate.signin',
    appleRedirectUrl: '',
    googleWebClientId: 'REPLACE_ME.apps.googleusercontent.com',
    googleIosClientId: 'REPLACE_ME.apps.googleusercontent.com',
  },
  security: {
    idleLockMinutes: 5,
    maxLoginAttemptsBeforeBackoff: 3,
  },
};
