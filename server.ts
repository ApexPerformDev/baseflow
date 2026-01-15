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

// Nuvemshop credentials
const NUVEMSHOP_APP_ID = "25051";
const NUVEMSHOP_CLIENT_SECRET = "b497856ad65ae4ebc58762fd2c032e4933b2c0171edc785c";

// Simulação de banco de dados em memória (em produção, use Deno KV ou PostgreSQL)
const users = new Map();
const stores = new Map();
const storeUsers = new Map();

// Deno KV para persistência
let kv;
try {
  kv = await Deno.openKv();
  console.log("✅ Deno KV conectado");
} catch (error) {
  console.log("⚠️ Deno KV não disponível, usando apenas memória:", error.message);
  kv = null;
}

// Carregar dados do KV na inicialização
async function loadData() {
  if (!kv) {
    console.log("📊 Usando apenas memória (sem persistência)");
    return;
  }
  
  try {
    const userEntries = kv.list({ prefix: ["users"] });
    for await (const entry of userEntries) {
      const email = entry.key[1];
      users.set(email, entry.value);
    }
    
    const storeEntries = kv.list({ prefix: ["stores"] });
    for await (const entry of storeEntries) {
      const storeId = entry.key[1];
      stores.set(storeId, entry.value);
    }
    
    const storeUserEntries = kv.list({ prefix: ["store_users"] });
    for await (const entry of storeUserEntries) {
      const key = entry.key[1];
      storeUsers.set(key, entry.value);
    }
    
    console.log(`📊 Dados carregados: ${users.size} usuários, ${stores.size} lojas, ${storeUsers.size} vínculos`);
  } catch (error) {
    console.log("⚠️ Erro ao carregar dados do KV:", error.message);
  }
}

// Salvar dados no KV
async function saveUser(email, user) {
  users.set(email, user);
  if (kv) {
    try {
      await kv.set(["users", email], user);
    } catch (error) {
      console.log("⚠️ Erro ao salvar usuário no KV:", error.message);
    }
  }
}

async function saveStore(storeId, store) {
  stores.set(storeId, store);
  if (kv) {
    try {
      await kv.set(["stores", storeId], store);
    } catch (error) {
      console.log("⚠️ Erro ao salvar loja no KV:", error.message);
    }
  }
}

async function saveStoreUser(key, storeUser) {
  storeUsers.set(key, storeUser);
  if (kv) {
    try {
      await kv.set(["store_users", key], storeUser);
    } catch (error) {
      console.log("⚠️ Erro ao salvar vínculo no KV:", error.message);
    }
  }
}

// Carregar dados na inicialização
await loadData();

// Rota de teste
router.get("/api/hello", (ctx) => {
  ctx.response.body = { 
    message: "Olá! O back-end do Baseflow no Deno está funcionando!",
    timestamp: new Date().toISOString()
  };
});

// Registro de usuário
router.post("/api/auth/register", async (ctx) => {
  console.log("📝 Recebida requisição POST /api/auth/register");
  console.log("Headers:", Object.fromEntries(ctx.request.headers.entries()));
  
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    console.log("📦 Body da requisição:", body);
    const { email, password, name } = body;

    if (users.has(email)) {
      console.log("❌ Usuário já existe:", email);
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

    await saveUser(email, user);
    console.log("👤 Usuário criado:", email);

    const token = await create(
      { alg: "HS256", typ: "JWT" },
      { userId: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30) },
      key
    );

    ctx.response.body = { user: { id: user.id, email: user.email, name: user.name }, token };
    console.log("✅ Resposta enviada com sucesso");
  } catch (error) {
    console.error("❌ Erro ao registrar usuário:", error);
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
  console.log("📝 Recebida requisição POST /api/stores");
  console.log("Headers:", Object.fromEntries(ctx.request.headers.entries()));
  
  try {
    const authHeader = ctx.request.headers.get("Authorization");
    console.log("🔑 Auth header:", authHeader);
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("❌ Token não fornecido");
      ctx.response.status = 401;
      ctx.response.body = { error: "Token não fornecido" };
      return;
    }
    
    const token = authHeader.substring(7);
    const payload = await verify(token, key);
    console.log("👤 Payload do token:", payload);
    
    const body = await ctx.request.body({ type: "json" }).value;
    console.log("📦 Body da requisição:", body);
    
    const now = new Date();
    const isAdmin = payload.email === 'apexperformgw@gmail.com';
    console.log("👑 É admin?", isAdmin);
    
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
    
    await saveStore(store.id, store);
    console.log("🏪 Loja criada:", store.id, store.name);
    
    const storeUserKey = `${store.id}-${payload.userId}`;
    await saveStoreUser(storeUserKey, {
      store_id: store.id,
      user_email: payload.email,
      role: 'admin',
      accepted_at: now.toISOString()
    });
    console.log("🔗 Vínculo criado:", storeUserKey);
    
    ctx.response.body = store;
    console.log("✅ Resposta enviada com sucesso");
  } catch (error) {
    console.error("❌ Erro ao criar loja:", error);
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

// Nuvemshop OAuth callback
router.get("/api/nuvemshop/callback", async (ctx) => {
  console.log("🔗 Callback Nuvemshop recebido");
  const code = ctx.request.url.searchParams.get('code');
  const state = ctx.request.url.searchParams.get('state');
  
  console.log("Code:", code);
  console.log("State:", state);
  
  if (!code) {
    ctx.response.redirect(`https://baseflow-jade.vercel.app/nuvemshop/error?error=no_code`);
    return;
  }
  
  try {
    // Trocar código por access token
    const tokenResponse = await fetch('https://www.nuvemshop.com.br/apps/authorize/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: NUVEMSHOP_APP_ID,
        client_secret: NUVEMSHOP_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code
      })
    });
    
    const tokenData = await tokenResponse.json();
    console.log("Token data:", tokenData);
    
    if (tokenData.access_token) {
      // Redirecionar com sucesso
      ctx.response.redirect(`https://baseflow-jade.vercel.app/nuvemshop/success?token=${tokenData.access_token}&store_id=${tokenData.user_id}`);
    } else {
      ctx.response.redirect(`https://baseflow-jade.vercel.app/nuvemshop/error?error=token_failed`);
    }
  } catch (error) {
    console.error("Erro no OAuth:", error);
    ctx.response.redirect(`https://baseflow-jade.vercel.app/nuvemshop/error?error=oauth_failed`);
  }
});

// Webhook LGPD - Store redact
router.post("/api/webhooks/store/redact", async (ctx) => {
  console.log("🛡️ Webhook store redact recebido");
  const body = await ctx.request.body({ type: "json" }).value;
  console.log("Store redact data:", body);
  
  // Processar remoção de dados da loja conforme LGPD
  // Remover todos os dados relacionados à loja
  
  ctx.response.status = 200;
  ctx.response.body = { status: "success", message: "Store data redacted" };
});

// Webhook LGPD - Customer redact
router.post("/api/webhooks/customers/redact", async (ctx) => {
  console.log("🛡️ Webhook customer redact recebido");
  const body = await ctx.request.body({ type: "json" }).value;
  console.log("Customer redact data:", body);
  
  // Processar remoção de dados do cliente conforme LGPD
  // Remover todos os dados pessoais do cliente
  
  ctx.response.status = 200;
  ctx.response.body = { status: "success", message: "Customer data redacted" };
});

// Webhook LGPD - Customer data request
router.post("/api/webhooks/customers/data_request", async (ctx) => {
  console.log("📊 Webhook customer data request recebido");
  const body = await ctx.request.body({ type: "json" }).value;
  console.log("Customer data request:", body);
  
  // Processar solicitação de dados do cliente conforme LGPD
  // Retornar todos os dados que você tem sobre o cliente
  
  ctx.response.status = 200;
  ctx.response.body = { 
    status: "success", 
    message: "Customer data request processed",
    data: {
      // Aqui você retornaria os dados do cliente
      customer_id: body.customer_id,
      email: body.email,
      // ... outros dados
    }
  };
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
    await saveStore(storeId, updatedStore);
    
    ctx.response.body = updatedStore;
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: error.message };
  }
});

app.use(oakCors({
  origin: ["https://baseflow-jade.vercel.app", "http://localhost:3000", "http://localhost:5173"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(router.routes());
app.use(router.allowedMethods());

console.log("🚀 Servidor Deno rodando na porta 8000...");
console.log("📍 Rotas disponíveis:");
console.log("  GET  /api/hello");
console.log("  POST /api/auth/register");
console.log("  POST /api/auth/login");
console.log("  GET  /api/auth/me");
console.log("  POST /api/stores");
console.log("  GET  /api/stores");
console.log("  GET  /api/store-users");
console.log("  PUT  /api/stores/:id");
console.log("\n🔗 URL completa: https://apexperform-baseflow-10.deno.dev");
await app.listen({ port: 8000 });