import axios from 'axios';

// --- CONSOLIDATED AXIOS CONFIGURATION ---

// 1. Define the base URL for all API requests.
// This uses an environment variable which MUST be set in your Vercel project settings.
const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
const baseURL = `${backendUrl}/api`;

// 2. Create a new Axios instance with the base URL.
// Helpful runtime warnings for production builds to diagnose common deployment issues.
// Vite only injects env vars prefixed with VITE_ at build-time. If VITE_BACKEND_URL
// is missing in production the client will use a relative `/api` path which only
// works when a dev proxy is active. This log helps debug why deployed frontend
// cannot reach the backend.
try {
  if (import.meta.env.PROD && !backendUrl) {
    // eslint-disable-next-line no-console
    console.warn('[Config] VITE_BACKEND_URL is not set for production build. API requests will fail. baseURL is set to:', baseURL);
  }
  // Always print the effective base URL to make it easy to inspect in the browser console
  // eslint-disable-next-line no-console
  console.info('[Config] Axios baseURL is set to:', baseURL);
} catch (e) {
  // In case import.meta is unavailable for some reason, avoid breaking the app
}

const api = axios.create({
  baseURL,
});

// 3. Add a request interceptor to automatically attach the auth token.
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 4. Add interceptors for logging requests and responses to aid debugging.
api.interceptors.request.use(config => {
  try {
    console.log('[Axios] Request:', config.method.toUpperCase(), config.url, 'data keys:', config.data ? Object.keys(config.data) : 'none');
  } catch (e) {
    // ignore
  }
  return config;
});

api.interceptors.response.use(response => {
  try {
    console.log('[Axios] Response:', response.status, response.config && response.config.url, 'data keys:', response.data ? Object.keys(response.data) : 'none');
  } catch (e) {
    // ignore
  }
  return response;
}, error => {
  try {
    console.error('[Axios] Response error:', error?.response?.status, error?.response?.data || error.message);
  } catch (e) {}
  return Promise.reject(error);
});

// 5. Export the configured instance for use throughout the app.
export default api;