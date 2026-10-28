import { AppEnvironment } from './environment.model';

/**
 * Real backend on your computer (npm run start:api). The API address follows the page's host, so the same
 * build works on the laptop (localhost) and on a phone on the same Wi-Fi (http://<laptop-ip>:4200).
 */
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
    googleWebClientId: '',
    googleIosClientId: '',
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
