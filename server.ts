import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { create } from "https://deno.land/x/djwt@v3.0.1/mod.ts";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";

const app = new Application();
const router = new Router();

// --- CONFIGURAÇÕES ---
const NUVEMSHOP_APP_ID = "25051";
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
const kv = await Deno.openKv();

// Sincroniza usuários do banco de dados para a memória ao iniciar
for await (const entry of kv.list({ prefix: ["users"] })) {
  users.set(entry.key[1], entry.value);
}

// --- MIDDLEWARE DE CORS (AQUI ESTAVA O ERRO) ---
app.use(oakCors({
  origin: [FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
  methods: "GET,POST,PUT,DELETE,OPTIONS",
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  credentials: true,
}));

// --- ROTAS ---

router.post("/api/auth/register", async (ctx) => {
  const body = await ctx.request.body({ type: "json" }).value;
  const { email, password, name } = body;

  const hashedPassword = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  const passwordHash = Array.from(new Uint8Array(hashedPassword)).map(b => b.toString(16).padStart(2, '0')).join('');

  const user = { id: crypto.randomUUID(), email, name, password: passwordHash };
  
  users.set(email, user);
  await kv.set(["users", email], user);

  const token = await create({ alg: "HS256", typ: "JWT" }, { userId: user.id, email, exp: Math.floor(Date.now() / 1000) + 2592000 }, key);
  ctx.response.body = { user: { id: user.id, email, name }, token };
});

router.post("/api/auth/login", async (ctx) => {
  const body = await ctx.request.body({ type: "json" }).value;
  const { email, password } = body;
  const user = users.get(email);

  if (!user) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Usuário não encontrado" };
    return;
  }

  const hashedPassword = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  const passwordHash = Array.from(new Uint8Array(hashedPassword)).map(b => b.toString(16).padStart(2, '0')).join('');

  if (user.password !== passwordHash) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Senha incorreta" };
    return;
  }

  const token = await create({ alg: "HS256", typ: "JWT" }, { userId: user.id, email, exp: Math.floor(Date.now() / 1000) + 2592000 }, key);
  ctx.response.body = { user: { id: user.id, email, name: user.name }, token };
});

router.get("/api/nuvemshop/auth", (ctx) => {
  ctx.response.redirect(`https://www.nuvemshop.com.br/apps/${NUVEMSHOP_APP_ID}/authorize?scope=write_products,read_orders`);
});

app.use(router.routes());
app.use(router.allowedMethods());

console.log("🚀 Server Ready");
await app.listen({ port: 8000 });