import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { create } from "https://deno.land/x/djwt@v3.0.1/mod.ts";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";

const app = new Application();
const router = new Router();

// --- CONFIGURAÇÕES ---
const NUVEMSHOP_APP_ID = "25051";
const NUVEMSHOP_CLIENT_SECRET = "b497856ad65ae4ebc58762fd2c032e4933b2c0171edc785c";
const FRONTEND_URL = "https://baseflow-jade.vercel.app";

const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode("your-secret-key-here"),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"]
);

// --- STORAGE (Deno KV) ---
const users = new Map();
const stores = new Map();

// Inicialização segura do KV para não perder usuários no deploy
const kv = await Deno.openKv();
async function syncFromKv() {
  for await (const entry of kv.list({ prefix: ["users"] })) {
    users.set(entry.key[1], entry.value);
  }
}
await syncFromKv();

async function saveUser(email: string, user: any) {
  users.set(email, user);
  await kv.set(["users", email], user);
}

// --- MIDDLEWARES (CORREÇÃO DE CORS) ---
app.use(oakCors({
  origin: [FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
  methods: "GET,POST,PUT,DELETE,OPTIONS",
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  credentials: true,
}));

// --- ROTAS DE AUTH ---

router.post("/api/auth/register", async (ctx) => {
  const body = await ctx.request.body({ type: "json" }).value;
  const { email, password, name } = body;

  if (users.has(email)) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Usuário já existe" };
    return;
  }

  const hashedPassword = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  const passwordHash = Array.from(new Uint8Array(hashedPassword)).map(b => b.toString(16).padStart(2, '0')).join('');

  const user = {
    id: crypto.randomUUID(),
    email, name,
    password: passwordHash,
    created_at: new Date().toISOString()
  };

  await saveUser(email, user);
  const token = await create({ alg: "HS256", typ: "JWT" }, { userId: user.id, email, exp: Math.floor(Date.now() / 1000) + 2592000 }, key);
  ctx.response.body = { user: { id: user.id, email, name }, token };
});

router.post("/api/auth/login", async (ctx) => {
  const body = await ctx.request.body({ type: "json" }).value;
  const { email, password } = body;
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
});

// --- ROTAS NUVEMSHOP ---

router.get("/api/nuvemshop/auth", (ctx) => {
  ctx.response.redirect(`https://www.nuvemshop.com.br/apps/${NUVEMSHOP_APP_ID}/authorize?scope=write_products,read_orders`);
});

router.get("/api/nuvemshop/callback", async (ctx) => {
  const code = ctx.request.url.searchParams.get('code');
  if (!code) {
    ctx.response.redirect(`${FRONTEND_URL}/nuvemshop/error?error=no_code`);
    return;
  }

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
    ctx.response.redirect(`${FRONTEND_URL}/nuvemshop/success?token=${tokenData.access_token}&store_id=${tokenData.user_id}`);
  } else {
    ctx.response.redirect(`${FRONTEND_URL}/nuvemshop/error?error=token_failed`);
  }
});

router.get("/api/hello", (ctx) => {
  ctx.response.body = { message: "API OK", users: users.size };
});

app.use(router.routes());
app.use(router.allowedMethods());

console.log("🚀 Server running on port 8000");
await app.listen({ port: 8000 });