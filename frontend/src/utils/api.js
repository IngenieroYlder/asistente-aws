import axios from 'axios';

const VITE_API_URL = import.meta.env.VITE_API_URL || '/api';

// Derivamos la URL base (sin el /api) para los archivos estáticos
export const BASE_URL = VITE_API_URL.replace(/\/api$/, '');

const api = axios.create({
  baseURL: VITE_API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Bypass ngrok warning page for API calls
  config.headers['ngrok-skip-browser-warning'] = 'true';
  return config;
});

export default api;
