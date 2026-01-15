const API_BASE_URL = 'https://apexperform-baseflow-10.deno.dev/api';

class Base44Client {
  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  auth = {
    register: async (userData) => {
      const response = await this.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData)
      });
      this.setToken(response.token);
      return response.user;
    },

    login: async (email, password) => {
      const response = await this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      this.setToken(response.token);
      return response.user;
    },

    me: async () => {
      return this.request('/auth/me');
    },

    logout: () => {
      this.clearToken();
    }
  };

  entities = {
    Store: {
      create: async (storeData) => {
        return this.request('/stores', {
          method: 'POST',
          body: JSON.stringify(storeData)
        });
      },

      list: async () => {
        return this.request('/stores');
      },

      update: async (id, data) => {
        return this.request(`/stores/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data)
        });
      }
    },

    StoreUser: {
      filter: async (filters) => {
        return this.request('/store-users');
      }
    },

    Order: {
      filter: async (filters) => {
        return [];
      }
    },

    Customer: {
      filter: async (filters) => {
        return [];
      }
    },

    RFMAnalysis: {
      filter: async (filters) => {
        return [];
      }
    }
  };

  integrations = {
    Core: {
      CreateStripeCheckoutSession: async (data) => {
        return this.request('/stripe/create-checkout-session', {
          method: 'POST',
          body: JSON.stringify(data)
        });
      }
    }
  };
}

export const base44 = new Base44Client();
