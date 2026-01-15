import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { create, verify } from "https://deno.land/x/djwt@v3.0.1/mod.ts";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";

const app = new Application();
const router = new Router();

// JWT Key
const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode("your-secret-key-here"),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"]
);

// Nuvemshop credentials
const NUVEMSHOP_APP_ID = "25051";
const NUVEMSHOP_CLIENT_SECRET = "b497856ad65ae4ebc58762fd2c032e4933b2c0171edc785c";

// In-memory storage
const users = new Map();
const stores = new Map();
const storeUsers = new Map();

// KV storage (optional)
let kv = null;
try {
  kv = await Deno.openKv();
  // Load existing data
  for await (const entry of kv.list({ prefix: ["users"] })) {
    users.set(entry.key[1], entry.value);
  }
  for await (const entry of kv.list({ prefix: ["stores"] })) {
    stores.set(entry.key[1], entry.value);
  }
  for await (const entry of kv.list({ prefix: ["store_users"] })) {
    storeUsers.set(entry.key[1], entry.value);
  }
} catch (e) {
  console.log("KV not available, using memory only");
}

// Save functions
async function saveUser(email, user) {
  users.set(email, user);
  if (kv) try { await kv.set(["users", email], user); } catch (e) {}
}

async function saveStore(id, store) {
  stores.set(id, store);
  if (kv) try { await kv.set(["stores", id], store); } catch (e) {}
}

async function saveStoreUser(key, storeUser) {
  storeUsers.set(key, storeUser);
  if (kv) try { await kv.set(["store_users", key], storeUser); } catch (e) {}
}

// Routes
router.get("/api/hello", (ctx) => {
  ctx.response.body = { message: "API OK", timestamp: new Date().toISOString() };
});

router.post("/api/auth/register", async (ctx) => {
  try {
    const { email, password, name } = await ctx.request.body({ type: "json" }).value;
    
    if (users.has(email)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Usuário já existe" };
      return;
    }

    const hashedPassword = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
    const user = {
      id: crypto.randomUUID(),
      email, name,
      password: Array.from(new Uint8Array(hashedPassword)).map(b => b.toString(16).padStart(2, '0')).join(''),
      created_at: new Date().toISOString()
    };

    await saveUser(email, user);
    const token = await create({ alg: "HS256", typ: "JWT" }, { userId: user.id, email, exp: Math.floor(Date.now() / 1000) + 2592000 }, key);
    ctx.response.body = { user: { id: user.id, email, name }, token };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: error.message };
  }
});

router.post("/api/auth/login", async (ctx) => {
  try {
    const { email, password } = await ctx.request.body({ type: "json" }).value;
    const user = users.get(email);
    
    if (!user) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Credenciais inválidas" };
      return;
    }

    const hashedPassword = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
    const passwordHash = Array.from(new Uint8Array(hashedPassword)).map(b => b.toString(16).padStart(2, '0')).join('');

    if (user.password !== passwordHash) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Credenciais inválidas" };
      return;
    }

    const token = await create({ alg: "HS256", typ: "JWT" }, { userId: user.id, email, exp: Math.floor(Date.now() / 1000) + 2592000 }, key);
    ctx.response.body = { user: { id: user.id, email, name: user.name }, token };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: error.message };
  }
});

router.get("/api/auth/me", async (ctx) => {
  try {
    const authHeader = ctx.request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Token não fornecido" };
      return;
    }

    const payload = await verify(authHeader.substring(7), key);
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

router.post("/api/stores", async (ctx) => {
  try {
    const authHeader = ctx.request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Token não fornecido" };
      return;
    }
    
    const payload = await verify(authHeader.substring(7), key);
    const body = await ctx.request.body({ type: "json" }).value;
    
    const now = new Date();
    const isAdmin = payload.email === 'apexperformgw@gmail.com';
    
    const store = {
      id: crypto.randomUUID(),
      ...body,
      subscription_status: isAdmin ? 'ACTIVE' : 'TRIAL',
      trial_start_at: now.toISOString(),
      trial_end_at: isAdmin ? null : new Date(now.getTime() + 86400000).toISOString(),
      subscription_start_at: isAdmin ? now.toISOString() : null,
      subscription_end_at: isAdmin ? null : null,
      plan_type: isAdmin ? 'enterprise' : 'basic',
      created_date: now.toISOString()
    };
    
    await saveStore(store.id, store);
    await saveStoreUser(`${store.id}-${payload.userId}`, {
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

router.get("/api/stores", async (ctx) => {
  try {
    const authHeader = ctx.request.headers.get("Authorization");
    const payload = await verify(authHeader?.substring(7), key);
    
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

router.get("/api/store-users", async (ctx) => {
  try {
    const authHeader = ctx.request.headers.get("Authorization");
    const payload = await verify(authHeader?.substring(7), key);
    
    const userStoreUsers = Array.from(storeUsers.values())
      .filter(su => su.user_email === payload.email);
    
    ctx.response.body = userStoreUsers;
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: error.message };
  }
});

router.put("/api/stores/:id", async (ctx) => {
  try {
    const authHeader = ctx.request.headers.get("Authorization");
    const payload = await verify(authHeader?.substring(7), key);
    
    if (payload.email !== 'apexperformgw@gmail.com') {
      ctx.response.status = 403;
      ctx.response.body = { error: "Acesso negado" };
      return;
    }
    
    const storeId = ctx.params.id;
    const body = await ctx.request.body({ type: "json" }).value;
    const store = stores.get(storeId);
    
    if (!store) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Loja não encontrada" };
      return;
    }
    
    const updatedStore = { ...store, ...body };
    await saveStore(storeId, updatedStore);
    ctx.response.body = updatedStore;
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: error.message };
  }
});

// Nuvemshop routes
router.get("/api/nuvemshop/callback", async (ctx) => {
  const code = ctx.request.url.searchParams.get('code');
  if (!code) {
    ctx.response.redirect(`https://baseflow-jade.vercel.app/nuvemshop/error?error=no_code`);
    return;
  }
  
  try {
    const tokenResponse = await fetch('https://www.nuvemshop.com.br/apps/authorize/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: NUVEMSHOP_APP_ID,
        client_secret: NUVEMSHOP_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code
      })
    });
    
    const tokenData = await tokenResponse.json();
    if (tokenData.access_token) {
      ctx.response.redirect(`https://baseflow-jade.vercel.app/nuvemshop/success?token=${tokenData.access_token}&store_id=${tokenData.user_id}`);
    } else {
      ctx.response.redirect(`https://baseflow-jade.vercel.app/nuvemshop/error?error=token_failed`);
    }
  } catch (error) {
    ctx.response.redirect(`https://baseflow-jade.vercel.app/nuvemshop/error?error=oauth_failed`);
  }
});

// LGPD webhooks
router.post("/api/webhooks/store/redact", async (ctx) => {
  await ctx.request.body({ type: "json" }).value;
  ctx.response.body = { status: "success", message: "Store data redacted" };
});

router.post("/api/webhooks/customers/redact", async (ctx) => {
  await ctx.request.body({ type: "json" }).value;
  ctx.response.body = { status: "success", message: "Customer data redacted" };
});

router.post("/api/webhooks/customers/data_request", async (ctx) => {
  const body = await ctx.request.body({ type: "json" }).value;
  ctx.response.body = { 
    status: "success", 
    message: "Customer data request processed",
    data: { customer_id: body.customer_id, email: body.email }
  };
});

// Middleware
app.use(oakCors({
  origin: ["https://baseflow-jade.vercel.app", "http://localhost:3000", "http://localhost:5173"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(router.routes());
app.use(router.allowedMethods());

console.log("🚀 Server running on port 8000");
await app.listen({ port: 8000 });