import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  // FASE 1 - PROVA DE DEPLOY (PRIMEIRA LINHA)
  const PATH = new URL(req.url).pathname;
  console.log(`[PROOF] CODE_VERSION=FIX_CLONE_429_2026_01_14 PATH=${PATH} TS=${new Date().toISOString()}`);

  // ENDPOINT DE HEALTH
  if (req.headers.get('x-proof') === '1') {
    return Response.json({ ok: true, code_version: "FIX_CLONE_429_2026_01_14", path: PATH, ts: new Date().toISOString() });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const storeId = url.searchParams.get('store_id');

    if (!storeId) {
      return Response.json({ error: 'store_id parameter is required' }, { status: 400 });
    }

    // Verificar permissão
    const storeUsers = await base44.asServiceRole.entities.StoreUser.filter({
      store_id: storeId,
      user_email: user.email
    });

    if (storeUsers.length === 0) {
      return Response.json({ error: 'Access denied to this store' }, { status: 403 });
    }

    // Buscar integração Nuvemshop
    const integrations = await base44.asServiceRole.entities.Integration.filter({
      store_id: storeId,
      integration_type: 'NUVEMSHOP'
    });

    const integration = integrations[0];

    if (!integration) {
      return Response.json({
        storeId,
        connected: false,
        message: 'Nuvemshop não conectada'
      });
    }

    // Contar registros no banco
    const orders = await base44.asServiceRole.entities.Order.filter({ store_id: storeId });
    const customers = await base44.asServiceRole.entities.Customer.filter({ store_id: storeId });
    const products = await base44.asServiceRole.entities.Product.filter({ store_id: storeId });
    const allItems = await base44.asServiceRole.entities.OrderItem.list();
    const items = allItems.filter(item => {
      const order = orders.find(o => o.id === item.order_id);
      return order !== undefined;
    });

    // Contar análises
    const rfmAnalysis = await base44.asServiceRole.entities.RFMAnalysis.filter({ store_id: storeId });
    const abcAnalysis = await base44.asServiceRole.entities.ABCAnalysis.filter({ store_id: storeId });

    // Estatísticas dos pedidos
    const paidOrders = orders.filter(o => o.status === 'paid');
    const totalRevenue = paidOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    const lastOrder = orders.length > 0 ? orders.sort((a, b) => 
      new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
    )[0] : null;

    return Response.json({
      storeId,
      connected: true,
      integration: {
        nuvemshopStoreId: integration.store_url,
        status: integration.status,
        lastSyncAt: integration.last_sync,
        syncStatus: integration.sync_status,
        initialSyncCompleted: integration.initial_sync_completed,
        errorMessage: integration.sync_error_message
      },
      database: {
        ordersCount: orders.length,
        customersCount: customers.length,
        productsCount: products.length,
        itemsCount: items.length,
        rfmAnalysisCount: rfmAnalysis.length,
        abcAnalysisCount: abcAnalysis.length
      },
      statistics: {
        paidOrdersCount: paidOrders.length,
        totalRevenue: totalRevenue.toFixed(2),
        lastOrderDate: lastOrder?.order_date || null,
        lastOrderId: lastOrder?.external_id || null
      },
      sampleData: {
        latestCustomers: customers.slice(0, 3).map(c => ({
          id: c.id,
          name: c.name,
          email: c.email
        })),
        latestOrders: orders.slice(0, 3).map(o => ({
          id: o.id,
          external_id: o.external_id,
          total_amount: o.total_amount,
          order_date: o.order_date
        })),
        latestProducts: products.slice(0, 3).map(p => ({
          id: p.id,
          name: p.name,
          price: p.price
        }))
      }
    });

  } catch (error) {
    console.error('[STATUS] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});