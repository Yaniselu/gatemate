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
