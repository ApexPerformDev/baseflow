import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  // FASE 1 - PROVA DE DEPLOY (PRIMEIRA LINHA)
  const PATH = new URL(req.url).pathname;
  console.log(`[PROOF] CODE_VERSION=FIX_CLONE_429_2026_01_14 PATH=${PATH} TS=${new Date().toISOString()}`);

  // ENDPOINT DE HEALTH
  if (req.headers.get('x-proof') === '1') {
    return Response.json({ ok: true, code_version: "FIX_CLONE_429_2026_01_14", path: PATH, ts: new Date().toISOString() });
  }

  const bodyText = await req.text();
  const body = bodyText ? JSON.parse(bodyText) : {};

  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const store_id = body?.store_id;
    const also_reset_integration = body?.also_reset_integration;

    if (!store_id) {
      return Response.json({ error: 'store_id is required' }, { status: 400 });
    }

    console.log(`[RESET_DATA] Starting data reset for store ${store_id}, also_reset_integration: ${also_reset_integration}`);

    // Verificar se usuário é admin da loja
    const storeUsers = await base44.asServiceRole.entities.StoreUser.filter({ 
      store_id, 
      user_email: user.email 
    });

    if (storeUsers.length === 0 || storeUsers[0].role !== 'admin') {
      return Response.json({ error: 'Only store admins can reset store data' }, { status: 403 });
    }

    const deletedCounts = {
      orders: 0,
      order_items: 0,
      customers: 0,
      products: 0,
      rfm_analysis: 0,
      abc_analysis: 0
    };

    // 1. Apagar RFM Analysis
    console.log('[RESET_DATA] Deleting RFM analyses...');
    const rfmAnalyses = await base44.asServiceRole.entities.RFMAnalysis.filter({ store_id });
    for (const rfm of rfmAnalyses) {
      await base44.asServiceRole.entities.RFMAnalysis.delete(rfm.id);
    }
    deletedCounts.rfm_analysis = rfmAnalyses.length;
    console.log(`[RESET_DATA] Deleted ${rfmAnalyses.length} RFM analyses`);

    // 2. Apagar ABC Analysis
    console.log('[RESET_DATA] Deleting ABC analyses...');
    const abcAnalyses = await base44.asServiceRole.entities.ABCAnalysis.filter({ store_id });
    for (const abc of abcAnalyses) {
      await base44.asServiceRole.entities.ABCAnalysis.delete(abc.id);
    }
    deletedCounts.abc_analysis = abcAnalyses.length;
    console.log(`[RESET_DATA] Deleted ${abcAnalyses.length} ABC analyses`);

    // 3. Apagar Order Items
    console.log('[RESET_DATA] Deleting order items...');
    const orders = await base44.asServiceRole.entities.Order.filter({ store_id });
    const orderIds = orders.map(o => o.id);
    
    const allOrderItems = await base44.asServiceRole.entities.OrderItem.list();
    const storeOrderItems = allOrderItems.filter(item => orderIds.includes(item.order_id));
    
    for (const item of storeOrderItems) {
      await base44.asServiceRole.entities.OrderItem.delete(item.id);
    }
    deletedCounts.order_items = storeOrderItems.length;
    console.log(`[RESET_DATA] Deleted ${storeOrderItems.length} order items`);

    // 4. Apagar Orders
    console.log('[RESET_DATA] Deleting orders...');
    for (const order of orders) {
      await base44.asServiceRole.entities.Order.delete(order.id);
    }
    deletedCounts.orders = orders.length;
    console.log(`[RESET_DATA] Deleted ${orders.length} orders`);

    // 5. Apagar Products
    console.log('[RESET_DATA] Deleting products...');
    const products = await base44.asServiceRole.entities.Product.filter({ store_id });
    for (const product of products) {
      await base44.asServiceRole.entities.Product.delete(product.id);
    }
    deletedCounts.products = products.length;
    console.log(`[RESET_DATA] Deleted ${products.length} products`);

    // 6. Apagar Customers
    console.log('[RESET_DATA] Deleting customers...');
    const customers = await base44.asServiceRole.entities.Customer.filter({ store_id });
    for (const customer of customers) {
      await base44.asServiceRole.entities.Customer.delete(customer.id);
    }
    deletedCounts.customers = customers.length;
    console.log(`[RESET_DATA] Deleted ${customers.length} customers`);

    // 7. Reset Integration se solicitado
    if (also_reset_integration) {
      console.log('[RESET_DATA] Resetting integration...');
      const integrations = await base44.asServiceRole.entities.Integration.filter({
        store_id,
        integration_type: 'NUVEMSHOP'
      });

      if (integrations.length > 0) {
        const integration = integrations[0];
        await base44.asServiceRole.entities.Integration.update(integration.id, {
          status: 'disconnected',
          sync_status: 'idle',
          api_key: null,
          nuvemshop_store_id: null,
          store_url: null,
          last_sync: null,
          initial_sync_completed: false,
          sync_error_message: null
        });
        console.log('[RESET_DATA] Integration disconnected and reset');
      }
    }

    console.log('[RESET_DATA] Data reset completed successfully');

    return Response.json({
      success: true,
      message: 'Dados apagados com sucesso. A loja está pronta para importar dados reais da API.',
      deleted: deletedCounts,
      integration_reset: also_reset_integration || false
    });

  } catch (error) {
    console.error('[RESET_DATA] Error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});