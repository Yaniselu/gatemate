import { AppEnvironment } from './environment.model';

/** Static web preview: mock data and hash routing so it works from any sub-path. */
export const environment: AppEnvironment = {
  production: true,
  useMocks: true,
  hashRouting: true,
  apiUrl: '/api/v1',
  allowedApiOrigins: [],
  auth: {
    appleEnabled: false,
    appleServiceId: 'app.gatemate.signin',
    appleRedirectUrl: '',
    googleWebClientId: '',
    googleIosClientId: '',
  },
  push: false,
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
