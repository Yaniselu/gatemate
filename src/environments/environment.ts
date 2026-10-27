import { AppEnvironment } from './environment.model';

/** Development: runs fully on mock data until the Java backend is ready. */
export const environment: AppEnvironment = {
  production: false,
  useMocks: true,
  hashRouting: false,
  apiUrl: 'http://localhost:8080/api/v1',
  allowedApiOrigins: ['http://localhost:8080'],
  auth: {
    // Public OAuth client identifiers only. Secrets never belong in the app bundle.
    appleServiceId: 'app.gatemate.signin',
    appleRedirectUrl: '',
    googleWebClientId: 'REPLACE_ME.apps.googleusercontent.com',
    googleIosClientId: 'REPLACE_ME.apps.googleusercontent.com',
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
