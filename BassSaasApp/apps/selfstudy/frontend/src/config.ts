const getApiUrl = (): string => {
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim() !== '') {
    return import.meta.env.VITE_API_URL.trim();
  }
  // In production or single-container mode, relative path "" matches current domain & port
  if (import.meta.env.PROD) {
    return '';
  }
  // Local development fallback
  return 'http://localhost:8001';
};

export const API_URL = getApiUrl();
