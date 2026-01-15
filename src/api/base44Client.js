// Localização sugerida: src/api/base44Client.js

// Prioriza a variável de ambiente da Vercel, com fallback para o link direto do Deno
const API_BASE_URL = (import.meta.env.VITE_API_URL || "https://apexperform-baseflow-10.deno.dev") + "/api";

class Base44Client {
  constructor() {
    // Busca o token salvo para manter a sessão ativa ao recarregar
    this.token = localStorage.getItem("auth_token");

    // Helper para rotas de integração (Nuvemshop, etc)
    const createIntegrationHandler = (name) => ({
      getAuthUrl: async (params) => {
        const query = params ? "?" + new URLSearchParams(params).toString() : "";
        return this.request(`/${name.toLowerCase()}/auth${query}`);
      },
      invoke: async (action, data) => {
        return this.request(`/${name.toLowerCase()}/${action}`, {
          method: "POST",
          body: JSON.stringify(data),
        });
      },
    });

    const manualIntegrations = {
      Core: {
        CreateStripeCheckoutSession: async (data) => {
          return this.request("/stripe/create-checkout-session", {
            method: "POST",
            body: JSON.stringify(data),
          });
        },
      },
      Nuvemshop: createIntegrationHandler("nuvemshop"),
      nuvemshop: createIntegrationHandler("nuvemshop"),
      NuvemShop: createIntegrationHandler("nuvemshop"),
      nuvem_shop: createIntegrationHandler("nuvemshop"),
    };

    this.integrations = new Proxy(manualIntegrations, {
      get: (target, prop) => {
        if (prop in target) return target[prop];
        return createIntegrationHandler(String(prop));
      },
    });
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem("auth_token", token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem("auth_token");
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Se o backend enviar um redirect (muito comum no fluxo da Nuvemshop)
    if (response.redirected) {
      window.location.href = response.url;
      return;
    }

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: `Erro HTTP: ${response.status}` }));
      throw new Error(error.error || `Erro HTTP: ${response.status}`);
    }

    return response.json();
  }

  auth = {
    register: async (userData) => {
      const response = await this.request("/auth/register", {
        method: "POST",
        body: JSON.stringify(userData),
      });
      this.setToken(response.token);
      return response.user;
    },

    login: async (email, password) => {
      const response = await this.request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (response.token) {
        this.setToken(response.token);
      }
      return response.user;
    },

    me: async () => {
      return this.request("/auth/me");
    },

    logout: () => {
      this.clearToken();
      window.location.href = '/login';
    },
  };

  entities = {
    Store: {
      create: async (storeData) => {
        return this.request("/stores", {
          method: "POST",
          body: JSON.stringify(storeData),
        });
      },
      list: async () => {
        return this.request("/stores");
      },
      get: async (id) => {
        return this.request(`/stores/${id}`);
      },
      update: async (id, data) => {
        return this.request(`/stores/${id}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
      },
    },
    StoreUser: {
      filter: async () => {
        return this.request("/store-users");
      },
    },
  };
}

export const base44 = new Base44Client();