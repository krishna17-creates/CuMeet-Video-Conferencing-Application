import axios from 'axios';
import { setupInterceptors } from './interceptor';

// --- CONSOLIDATED AXIOS CONFIGURATION ---
const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
const baseURL = `${backendUrl}/api`;

try {
  if (import.meta.env.PROD && !backendUrl) {
    // eslint-disable-next-line no-console
    console.warn('[Config] VITE_BACKEND_URL is not set for production build. API requests will fail. baseURL is set to:', baseURL);
  }
  // eslint-disable-next-line no-console
  console.info('[Config] Axios baseURL is set to:', baseURL);
} catch (e) {
  // Ignore runtime logging failures.
}

const api = axios.create({
  baseURL,
});

export const setupErrorHandler = (errorHandler) => {
  setupInterceptors(api, errorHandler);
};

export default api;
