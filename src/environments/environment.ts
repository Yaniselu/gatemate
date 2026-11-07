import { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: false,
  useMocks: true,
  hashRouting: false,
  apiUrl: 'http://localhost:8080/api/v1',
  allowedApiOrigins: ['http://localhost:8080'],
  auth: {
    appleEnabled: false,
    appleServiceId: 'app.gatemate.signin',
    appleRedirectUrl: '',
    googleWebClientId: '672185328276-svrdqt9jnkm8g8nm7ske2divdu85jral.apps.googleusercontent.com',
    googleIosClientId: 'REPLACE_ME.apps.googleusercontent.com',
  },
  push: false,
  purchases: { iosApiKey: '', androidApiKey: '' },
  maps: {
    satelliteTiles: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    labelTiles: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics · Gates © OpenStreetMap contributors',
  },
  security: {
    idleLockMinutes: 5,
    maxLoginAttemptsBeforeBackoff: 3,
  },
};
