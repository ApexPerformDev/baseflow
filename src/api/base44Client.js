const API_BASE_URL = "https://apexperform-baseflow-10.deno.dev/api";

class Base44Client {
  constructor() {
    this.token = localStorage.getItem("auth_token");

    // Helper ajustado para bater com as rotas do seu servidor Deno
    const createIntegrationHandler = (name) => ({
      getAuthUrl: async (params) => {
        // Ajustado: Removido o prefixo extra para alinhar com o router.get("/api/nuvemshop/auth")
        return this.request(`/${name.toLowerCase()}/auth`);
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
      // Definições para Nuvemshop
      Nuvemshop: createIntegrationHandler("nuvemshop"),
      nuvemshop: createIntegrationHandler("nuvemshop"),
      NuvemShop: createIntegrationHandler("nuvemshop"),
      nuvem_shop: createIntegrationHandler("nuvemshop"),
    };

    this.integrations = new Proxy(manualIntegrations, {
      get: (target, prop) => {
        if (prop in target) return target[prop];

        if (prop === "invoke") {
          return async (integration, action, data) => {
            return this.request(`/${integration}/${action}`, {
              method: "POST",
              body: JSON.stringify(data),
            });
          };
        }

        return {
          getAuthUrl: async (params) => {
            return this.request(`/${String(prop).toLowerCase()}/auth`);
          },
          invoke: async (action, data) => {
            return this.request(
              `/${String(prop).toLowerCase()}/${action}`,
              {
                method: "POST",
                body: JSON.stringify(data),
              }
            );
          },
        };
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

    // Se o backend enviar um redirect (como na Nuvemshop), tratamos aqui
    if (response.redirected) {
      window.location.href = response.url;
      return;
    }

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(error.error || `HTTP ${response.status}`);
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
      this.setToken(response.token);
      return response.user;
    },

    me: async () => {
      return this.request("/auth/me");
    },

    logout: () => {
      this.clearToken();
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