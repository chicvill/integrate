/**
 * MQnet Shared API Client (@mqnet/ui/apiClient)
 * Automatically injects X-App-ID and Authorization Bearer JWT token into requests.
 */

export class ApiClient {
  constructor(appId = '', baseUrl = '') {
    this.appId = appId;
    this.baseUrl = baseUrl;
  }

  getToken() {
    return localStorage.getItem('mqnet_token') || localStorage.getItem('token') || '';
  }

  setToken(token) {
    if (token) {
      localStorage.setItem('mqnet_token', token);
    } else {
      localStorage.removeItem('mqnet_token');
    }
  }

  getUser() {
    try {
      const userStr = localStorage.getItem('mqnet_user') || localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }

  setUser(user) {
    if (user) {
      localStorage.setItem('mqnet_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('mqnet_user');
    }
  }

  logout() {
    this.setToken('');
    this.setUser(null);
  }

  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-App-ID': this.appId,
      ...(options.headers || {})
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  put(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

export const createApiClient = (appId, baseUrl = '') => new ApiClient(appId, baseUrl);
