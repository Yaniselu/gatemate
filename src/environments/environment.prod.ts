import { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: true,
  useMocks: false,
  hashRouting: false,
  apiUrl: 'https://gatemate-api-2n16.onrender.com/api/v1',
  allowedApiOrigins: ['https://gatemate-api-2n16.onrender.com'],
  auth: {
    appleEnabled: false,
    appleServiceId: 'app.gatemate.signin',
    appleRedirectUrl: '',
    googleWebClientId: '672185328276-svrdqt9jnkm8g8nm7ske2divdu85jral.apps.googleusercontent.com',
    googleIosClientId: '672185328276-5tlngg2iq8und9nk1dhhfmscgktqtt5v.apps.googleusercontent.com',
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
