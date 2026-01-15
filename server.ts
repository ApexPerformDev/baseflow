import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { create, verify } from "https://deno.land/x/djwt@v3.0.1/mod.ts";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";

const app = new Application();
const router = new Router();

// Chave secreta para JWT (em produção, use variável de ambiente)
const JWT_SECRET = "your-secret-key-here";
const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(JWT_SECRET),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"]
);

// Simulação de banco de dados em memória (em produção, use Deno KV ou PostgreSQL)
const users = new Map();
const stores = new Map();
const storeUsers = new Map();

// Rota de teste
router.get("/api/hello", (ctx) => {
  ctx.response.body = { 
    message: "Olá! O back-end do Baseflow no Deno está funcionando!",
    timestamp: new Date().toISOString()
  };
});

// Registro de usuário
router.post("/api/auth/register", async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    const { email, password, name } = body;

    if (users.has(email)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Usuário já existe" };
      return;
    }

    const hashedPassword = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(password)
    );

    const user = {
      id: crypto.randomUUID(),
      email,
      name,
      password: Array.from(new Uint8Array(hashedPassword)).map(b => b.toString(16).padStart(2, '0')).join(''),
      created_at: new Date().toISOString()
    };

    users.set(email, user);

    const token = await create(
      { alg: "HS256", typ: "JWT" },
      { userId: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30) },
      key
    );

    ctx.response.body = { user: { id: user.id, email: user.email, name: user.name }, token };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: error.message };
  }
});

// Login
router.post("/api/auth/login", async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    const { email, password } = body;

    const user = users.get(email);
    if (!user) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Credenciais inválidas" };
      return;
    }

    const hashedPassword = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(password)
    );
    const passwordHash = Array.from(new Uint8Array(hashedPassword)).map(b => b.toString(16).padStart(2, '0')).join('');

    if (user.password !== passwordHash) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Credenciais inválidas" };
      return;
    }

    const token = await create(
      { alg: "HS256", typ: "JWT" },
      { userId: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30) },
      key
    );

    ctx.response.body = { user: { id: user.id, email: user.email, name: user.name }, token };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: error.message };
  }
});

// Verificar usuário atual
router.get("/api/auth/me", async (ctx) => {
  try {
    const authHeader = ctx.request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Token não fornecido" };
      return;
    }

    const token = authHeader.substring(7);
    const payload = await verify(token, key);
    
    const user = Array.from(users.values()).find(u => u.id === payload.userId);
    if (!user) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Usuário não encontrado" };
      return;
    }

    ctx.response.body = { id: user.id, email: user.email, name: user.name };
  } catch (error) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Token inválido" };
  }
});

// Criar loja
router.post("/api/stores", async (ctx) => {
  try {
    const authHeader = ctx.request.headers.get("Authorization");
    const token = authHeader?.substring(7);
    const payload = await verify(token, key);
    
    const body = await ctx.request.body({ type: "json" }).value;
    const now = new Date();
    
    const isAdmin = payload.email === 'apexperformgw@gmail.com';
    
    const store = {
      id: crypto.randomUUID(),
      ...body,
      subscription_status: isAdmin ? 'ACTIVE' : 'TRIAL',
      trial_start_at: now.toISOString(),
      trial_end_at: isAdmin ? null : new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      subscription_start_at: isAdmin ? now.toISOString() : null,
      subscription_end_at: isAdmin ? null : null,
      plan_type: isAdmin ? 'enterprise' : 'basic',
      created_date: now.toISOString()
    };
    
    stores.set(store.id, store);
    
    const storeUserKey = `${store.id}-${payload.userId}`;
    storeUsers.set(storeUserKey, {
      store_id: store.id,
      user_email: payload.email,
      role: 'admin',
      accepted_at: now.toISOString()
    });
    
    ctx.response.body = store;
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: error.message };
  }
});

// Listar lojas
router.get("/api/stores", async (ctx) => {
  try {
    const authHeader = ctx.request.headers.get("Authorization");
    const token = authHeader?.substring(7);
    const payload = await verify(token, key);
    
    const userStores = Array.from(storeUsers.values())
      .filter(su => su.user_email === payload.email)
      .map(su => stores.get(su.store_id))
      .filter(Boolean);
    
    ctx.response.body = userStores;
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: error.message };
  }
});

// Listar vínculos
router.get("/api/store-users", async (ctx) => {
  try {
    const authHeader = ctx.request.headers.get("Authorization");
    const token = authHeader?.substring(7);
    const payload = await verify(token, key);
    
    const userStoreUsers = Array.from(storeUsers.values())
      .filter(su => su.user_email === payload.email);
    
    ctx.response.body = userStoreUsers;
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: error.message };
  }
});

// Atualizar loja
router.put("/api/stores/:id", async (ctx) => {
  try {
    const authHeader = ctx.request.headers.get("Authorization");
    const token = authHeader?.substring(7);
    const payload = await verify(token, key);
    
    const storeId = ctx.params.id;
    const body = await ctx.request.body({ type: "json" }).value;
    
    const store = stores.get(storeId);
    if (!store) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Loja não encontrada" };
      return;
    }
    
    if (payload.email !== 'apexperformgw@gmail.com') {
      ctx.response.status = 403;
      ctx.response.body = { error: "Acesso negado" };
      return;
    }
    
    const updatedStore = { ...store, ...body };
    stores.set(storeId, updatedStore);
    
    ctx.response.body = updatedStore;
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: error.message };
  }
});

app.use(oakCors()); 
app.use(router.routes());
app.use(router.allowedMethods());

console.log("Servidor Deno rodando na porta 8000...");
await app.listen({ port: 8000 });