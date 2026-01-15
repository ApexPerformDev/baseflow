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

// Rota para criar sessão do Stripe Checkout
router.post("/api/stripe/create-checkout-session", async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    const { priceId, userId, storeId, successUrl, cancelUrl } = body;

    // Aqui você integraria com o Stripe
    // Por enquanto, retornamos uma URL fake
    const checkoutUrl = `https://checkout.stripe.com/pay/fake-session-id`;
    
    ctx.response.body = {
      url: checkoutUrl,
      sessionId: "fake-session-id"
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: error.message };
  }
});

// Webhook do Stripe para processar pagamentos
router.post("/api/stripe/webhook", async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    
    // Processar evento do Stripe
    if (body.type === "checkout.session.completed") {
      // Ativar assinatura no banco de dados
      console.log("Pagamento confirmado:", body.data.object);
    }
    
    ctx.response.body = { received: true };
  } catch (error) {
    ctx.response.status = 400;
    ctx.response.body = { error: error.message };
  }
});

// Habilita CORS para que a Vercel consiga acessar este servidor
app.use(oakCors()); 
app.use(router.routes());
app.use(router.allowedMethods());

console.log("Servidor Deno rodando na porta 8000...");
await app.listen({ port: 8000 });