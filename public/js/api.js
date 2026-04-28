const API_BASE = '';

const api = {
  async request(method, endpoint, body = null, customHeaders = {}) {
    const url = `${API_BASE}/api${endpoint}`;
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...customHeaders,
    };

    const options = { method, headers };
    if (body && method !== 'GET') {
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    try {
      const res = await fetch(url, options);
      const data = await res.json().catch(() => ({}));
      return data;
    } catch (err) {
      console.error('API Error:', err);
      return { success: false, message: 'Network error. Please try again.' };
    }
  },
  get(endpoint) { return this.request('GET', endpoint); },
  post(endpoint, body) { return this.request('POST', endpoint, body); },
  patch(endpoint, body) { return this.request('PATCH', endpoint, body); },
  put(endpoint, body) { return this.request('PUT', endpoint, body); },
  delete(endpoint) { return this.request('DELETE', endpoint); },
};

