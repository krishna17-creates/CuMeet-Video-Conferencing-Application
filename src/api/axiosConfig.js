import axios from 'axios';

// This sets the base URL for all axios requests to '/api'.
// Now, a request like `axios.get('/meetings')` will automatically become
// a request to '/api/meetings', which will be correctly handled by the Vite proxy.
axios.defaults.baseURL = import.meta.env.VITE_API_URL;

// This is a request interceptor that automatically adds the
// authentication token to every API request.
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token'); // Assuming you store the token in localStorage
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

