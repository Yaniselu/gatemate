import { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: true,
  useMocks: false,
  hashRouting: false,
  // Render deployment (see render.yaml). Change both lines when you move to your own domain.
  apiUrl: 'https://gatemate-api-2n16.onrender.com/api/v1',
  allowedApiOrigins: ['https://gatemate-api-2n16.onrender.com'],
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
