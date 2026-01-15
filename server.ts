import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { create, verify } from "https://deno.land/x/djwt@v3.0.1/mod.ts";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";

const app = new Application();
const router = new Router();

// 1. Configurações e Credenciais
const NUVEMSHOP_APP_ID = "25051";
const NUVEMSHOP_CLIENT_SECRET = "b497856ad65ae4ebc58762fd2c032e4933b2c0171edc785c";
const FRONTEND_URL = "https://baseflow-jade.vercel.app";

// JWT Key
const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode("your-secret-key-here"),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"]
);

// Armazenamento em Memória (e tentativa de KV)
const users = new Map();
const stores = new Map();
const storeUsers = new Map();

let kv = null;
try {
  kv = await Deno.openKv();
  console.log("✅ Deno KV conectado");
} catch (e) {
  console.log("⚠️ Deno KV não disponível, usando memória");
}

// 2. Middleware de Erro e CORS
app.use(async (ctx, next) => {
  try { await next(); } catch (err) {
    console.error('Server error:', err);
    ctx.response.status = 500;
    ctx.response.body = { error: 'Internal server error' };
  }
});

app.use(oakCors({
  origin: [FRONTEND_URL, "http://localhost:3000", "http://localhost:5173"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// 3. Rotas de Autenticação Nuvemshop (CORREÇÃO DO 404)

// Inicia o processo de conexão
router.get("/api/nuvemshop/auth", (ctx) => {
  // Redireciona o usuário para a página de permissão da Nuvemshop
  const url = `https://www.nuvemshop.com.br/apps/${NUVEMSHOP_APP_ID}/authorize?scope=write_products,read_orders`;
  ctx.response.redirect(url);
});

// Recebe o código após o usuário autorizar
router.get("/api/nuvemshop/callback", async (ctx) => {
  const code = ctx.request.url.searchParams.get('code');
  
  if (!code) {
    ctx.response.redirect(`${FRONTEND_URL}/nuvemshop/error?error=no_code`);
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
      // Aqui você salvaria o token no seu banco de dados
      ctx.response.redirect(`${FRONTEND_URL}/nuvemshop/success?token=${tokenData.access_token}&store_id=${tokenData.user_id}`);
    } else {
      ctx.response.redirect(`${FRONTEND_URL}/nuvemshop/error?error=token_failed`);
    }
  } catch (error) {
    ctx.response.redirect(`${FRONTEND_URL}/nuvemshop/error?error=server_error`);
  }
});

// 4. Outras Rotas (Auth, Hello, Webhooks)
router.get("/api/hello", (ctx) => {
  ctx.response.body = { 
    message: "API OK", 
    timestamp: new Date().toISOString(),
    env: "Deno Deploy"
  };
});

router.post("/api/auth/register", async (ctx) => {
  const { email, password, name } = await ctx.request.body({ type: "json" }).value;
  const hashedPassword = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  const user = { id: crypto.randomUUID(), email, name, password: Array.from(new Uint8Array(hashedPassword)).map(b => b.toString(16).padStart(2, '0')).join(''), created_at: new Date().toISOString() };
  users.set(email, user);
  const token = await create({ alg: "HS256", typ: "JWT" }, { userId: user.id, email, exp: Math.floor(Date.now() / 1000) + 2592000 }, key);
  ctx.response.body = { user: { id: user.id, email, name }, token };
});

// LGPD Webhooks
router.post("/api/webhooks/store/redact", (ctx) => { ctx.response.body = { status: "success" }; });
router.post("/api/webhooks/customers/redact", (ctx) => { ctx.response.body = { status: "success" }; });

// Aplicação das Rotas
app.use(router.routes());
app.use(router.allowedMethods());

console.log("🚀 Server running on port 8000");
await app.listen({ port: 8000 });