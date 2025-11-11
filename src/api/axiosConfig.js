import axios from 'axios';

// This sets the base URL for all axios requests to '/api'.
// Now, a request like `axios.get('/meetings')` will automatically become
// a request to '/api/meetings', which will be correctly handled by the Vite proxy.
const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
const baseURL = `${backendUrl}/api`;
axios.defaults.baseURL = baseURL;

// Helpful runtime warnings for production builds to diagnose common deployment issues.
// Vite only injects env vars prefixed with VITE_ at build-time. If VITE_BACKEND_URL
// is missing in production the client will use a relative `/api` path which only
// works when a dev proxy is active. This log helps debug why deployed frontend
// cannot reach the backend.
try {
  if (import.meta.env.PROD && !backendUrl) {
    // eslint-disable-next-line no-console
    console.warn('[Config] VITE_BACKEND_URL is not set (production). axios.baseURL set to', axios.defaults.baseURL, '\nThis will make requests relative to the frontend host and will fail unless the backend lives on the same origin.');
  }
  // Always print the effective base URL to make it easy to inspect in the browser console
  // eslint-disable-next-line no-console
  console.info('[Config] axios baseURL =', axios.defaults.baseURL);
} catch (e) {
  // In case import.meta is unavailable for some reason, avoid breaking the app
}

// This is a request interceptor that automatically adds the
// authentication token to every API request.
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token'); // Assuming you store the token in localStorage
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Debugging: log axios requests and responses to trace scheduling flow
axios.interceptors.request.use(config => {
  try {
    console.log('[Axios] Request:', config.method.toUpperCase(), config.url, 'data keys:', config.data ? Object.keys(config.data) : 'none');
  } catch (e) {
    // ignore
  }
  return config;
}, err => {
  console.error('[Axios] Request error:', err);
  return Promise.reject(err);
});

axios.interceptors.response.use(response => {
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

