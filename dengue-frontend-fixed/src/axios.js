import axios from 'axios';

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 ||
      error.response?.status === 403
    ) {
      const requestUrl = error.config?.url || '';

      const isAuthRequest =
        requestUrl.includes('/users/login') ||
        requestUrl.includes('/users/register') ||
        requestUrl.includes('/users/google-auth') ||
        requestUrl.includes('/users/verify-email') ||
        requestUrl.includes('/users/resend-verification');

      if (!isAuthRequest) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }

    return Promise.reject(error);
  }
);

export default api;