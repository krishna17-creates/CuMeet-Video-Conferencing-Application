/**
 * Axios Request/Response Interceptors
 * Handles auth tokens, error handling, and request/response transformations
 */

export const setupInterceptors = (apiInstance, errorHandler) => {
  apiInstance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      config.headers['X-Request-ID'] = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      if (import.meta.env.DEV) {
        console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
          data: config.data,
          headers: config.headers,
        });
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  apiInstance.interceptors.response.use(
    (response) => {
      if (import.meta.env.DEV) {
        console.log(`[API Response] ${response.status} ${response.config.url}`, {
          data: response.data,
        });
      }

      return response;
    },
    (error) => {
      const { response } = error;

      if (response) {
        switch (response.status) {
          case 401:
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            errorHandler({
              message: 'Session expired. Please login again.',
              code: 'AUTH_EXPIRED',
              type: 'error',
            });
            window.location.href = '/login';
            break;
          case 403:
            errorHandler({
              message: 'You do not have permission to perform this action.',
              code: 'FORBIDDEN',
              type: 'error',
            });
            break;
          case 404:
            errorHandler({
              message: response.data?.error?.message || 'Resource not found.',
              code: 'NOT_FOUND',
              type: 'warning',
            });
            break;
          case 422:
            errorHandler({
              message: response.data?.error?.message || 'Invalid input data.',
              code: 'VALIDATION_ERROR',
              type: 'warning',
            });
            break;
          case 429:
            errorHandler({
              message: 'Too many requests. Please try again later.',
              code: 'RATE_LIMIT',
              type: 'warning',
            });
            break;
          case 500:
          case 502:
          case 503:
            errorHandler({
              message: 'Server error. Please try again later.',
              code: 'SERVER_ERROR',
              type: 'error',
            });
            break;
          default:
            errorHandler({
              message: response.data?.error?.message || 'An error occurred',
              code: response.data?.error?.code || 'UNKNOWN_ERROR',
              type: 'error',
            });
        }
      } else if (error.request) {
        errorHandler({
          message: 'Network error. Please check your connection.',
          code: 'NETWORK_ERROR',
          type: 'error',
        });
      } else {
        errorHandler({
          message: error.message || 'An unexpected error occurred',
          code: 'CLIENT_ERROR',
          type: 'error',
        });
      }

      return Promise.reject(error);
    }
  );
};
