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

    if (!store_id) {
      return Response.json({ error: 'store_id is required' }, { status: 400 });
    }

    console.log(`[HARD_RESET] Starting hard reset for store ${store_id}`);

    // Verificar se usuário é admin da loja
    const storeUsers = await base44.asServiceRole.entities.StoreUser.filter({ 
      store_id, 
      user_email: user.email 
    });

    if (storeUsers.length === 0 || storeUsers[0].role !== 'admin') {
      return Response.json({ error: 'Only store admins can perform hard reset' }, { status: 403 });
    }

    // Buscar integração
    const integrations = await base44.asServiceRole.entities.Integration.filter({
      store_id,
      integration_type: 'NUVEMSHOP'
    });

    if (integrations.length === 0) {
      return Response.json({ error: 'Nuvemshop integration not found' }, { status: 404 });
    }

    const integration = integrations[0];

    // 1. Deletar todos os dados importados
    console.log('[HARD_RESET] Deleting imported data...');

    // RFM Analysis
    const rfmAnalyses = await base44.asServiceRole.entities.RFMAnalysis.filter({ store_id });
    for (const rfm of rfmAnalyses) {
      await base44.asServiceRole.entities.RFMAnalysis.delete(rfm.id);
    }
    console.log(`[HARD_RESET] Deleted ${rfmAnalyses.length} RFM analyses`);

    // ABC Analysis
    const abcAnalyses = await base44.asServiceRole.entities.ABCAnalysis.filter({ store_id });
    for (const abc of abcAnalyses) {
      await base44.asServiceRole.entities.ABCAnalysis.delete(abc.id);
    }
    console.log(`[HARD_RESET] Deleted ${abcAnalyses.length} ABC analyses`);

    // Order Items
    const orders = await base44.asServiceRole.entities.Order.filter({ store_id });
    const orderIds = orders.map(o => o.id);
    
    const allOrderItems = await base44.asServiceRole.entities.OrderItem.list();
    const storeOrderItems = allOrderItems.filter(item => orderIds.includes(item.order_id));
    
    for (const item of storeOrderItems) {
      await base44.asServiceRole.entities.OrderItem.delete(item.id);
    }
    console.log(`[HARD_RESET] Deleted ${storeOrderItems.length} order items`);

    // Orders
    for (const order of orders) {
      await base44.asServiceRole.entities.Order.delete(order.id);
    }
    console.log(`[HARD_RESET] Deleted ${orders.length} orders`);

    // Products
    const products = await base44.asServiceRole.entities.Product.filter({ store_id });
    for (const product of products) {
      await base44.asServiceRole.entities.Product.delete(product.id);
    }
    console.log(`[HARD_RESET] Deleted ${products.length} products`);

    // Customers
    const customers = await base44.asServiceRole.entities.Customer.filter({ store_id });
    for (const customer of customers) {
      await base44.asServiceRole.entities.Customer.delete(customer.id);
    }
    console.log(`[HARD_RESET] Deleted ${customers.length} customers`);

    // 2. Reset integration sync status
    console.log('[HARD_RESET] Resetting integration status...');
    await base44.asServiceRole.entities.Integration.update(integration.id, {
      last_sync: null,
      sync_status: 'idle',
      initial_sync_completed: false,
      sync_error_message: null,
      status: 'connected'
    });

    console.log('[HARD_RESET] Hard reset completed successfully');

    return Response.json({
      success: true,
      message: 'Hard reset concluído com sucesso',
      deleted: {
        orders: orders.length,
        customers: customers.length,
        products: products.length,
        order_items: storeOrderItems.length,
        rfm_analyses: rfmAnalyses.length,
        abc_analyses: abcAnalyses.length
      }
    });

  } catch (error) {
    console.error('[HARD_RESET] Error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});