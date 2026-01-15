import { Application, Router } from "https://deno.land/x/oak/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";

const app = new Application();
const router = new Router();

// Rota de teste para confirmar que o back-end está vivo
router.get("/api/hello", (ctx) => {
  ctx.response.body = { 
    message: "Olá! O back-end do Baseflow no Deno está funcionando!",
    timestamp: new Date().toISOString()
  };
});

// Habilita CORS para que a Vercel consiga acessar este servidor
app.use(oakCors()); 
app.use(router.routes());
app.use(router.allowedMethods());

console.log("Servidor Deno rodando...");
await app.listen({ port: 8000 });