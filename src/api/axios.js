import axios from 'axios';

// Create a new Axios instance with a base URL
const api = axios.create({
  baseURL: '/api', // This ensures every request is prefixed with /api
});

// Add a request interceptor to automatically attach the auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;