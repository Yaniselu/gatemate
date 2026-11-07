import { AppEnvironment } from './environment.model';

const host = typeof location !== 'undefined' && location.hostname ? location.hostname : 'localhost';
const api = `http://${host}:8080`;

export const environment: AppEnvironment = {
  production: false,
  useMocks: false,
  hashRouting: false,
  apiUrl: `${api}/api/v1`,
  allowedApiOrigins: [api],
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
