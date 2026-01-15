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

    console.log(`[VERIFY_STATUS] Checking status for store ${store_id}`);

    // Buscar integração
    const integrations = await base44.asServiceRole.entities.Integration.filter({
      store_id,
      integration_type: 'NUVEMSHOP'
    });

    if (integrations.length === 0) {
      return Response.json({
        connected: false,
        message: 'Nuvemshop não está conectada'
      });
    }

    const integration = integrations[0];
    const accessToken = integration.api_key;
    const nuvemshopStoreId = integration.store_url || integration.nuvemshop_store_id;

    console.log(`[VERIFY_STATUS] Integration found - Status: ${integration.status}, Store ID: ${nuvemshopStoreId}`);

    let tokenValid = false;
    let apiError = null;

    // Testar token com a API
    if (accessToken && nuvemshopStoreId) {
      try {
        console.log('[VERIFY_STATUS] Testing token with Nuvemshop API...');
        const testResponse = await fetch(
          `https://api.nuvemshop.com.br/v1/${nuvemshopStoreId}/store`,
          {
            headers: {
              'Authentication': `bearer ${accessToken}`,
              'User-Agent': 'Baseflow (contato@baseflow.com.br)',
              'Accept': 'application/json'
            }
          }
        );

        tokenValid = testResponse.ok;
        
        if (!testResponse.ok) {
          const errorBody = await testResponse.text();
          apiError = `API returned ${testResponse.status}: ${errorBody}`;
          console.log(`[VERIFY_STATUS] Token validation failed: ${apiError}`);
        } else {
          console.log('[VERIFY_STATUS] Token is valid');
        }
      } catch (error) {
        apiError = error.message;
        console.error('[VERIFY_STATUS] Error testing token:', error);
      }
    }

    // Contar dados no banco
    const orders = await base44.asServiceRole.entities.Order.filter({ store_id });
    const customers = await base44.asServiceRole.entities.Customer.filter({ store_id });
    const products = await base44.asServiceRole.entities.Product.filter({ store_id });
    
    const allOrderItems = await base44.asServiceRole.entities.OrderItem.list();
    const storeOrderItems = allOrderItems.filter(item => 
      orders.some(o => o.id === item.order_id)
    );

    const rfmAnalyses = await base44.asServiceRole.entities.RFMAnalysis.filter({ store_id });
    const abcAnalyses = await base44.asServiceRole.entities.ABCAnalysis.filter({ store_id });

    console.log(`[VERIFY_STATUS] DB counts - Orders: ${orders.length}, Customers: ${customers.length}, Products: ${products.length}`);

    return Response.json({
      connected: integration.status === 'connected',
      token_valid: tokenValid,
      nuvemshop_store_id: nuvemshopStoreId,
      integration_status: integration.status,
      last_sync: integration.last_sync,
      sync_status: integration.sync_status,
      sync_error_message: integration.sync_error_message,
      initial_sync_completed: integration.initial_sync_completed || false,
      api_error: apiError,
      db_counts: {
        orders: orders.length,
        customers: customers.length,
        products: products.length,
        order_items: storeOrderItems.length,
        rfm_analyses: rfmAnalyses.length,
        abc_analyses: abcAnalyses.length
      }
    });

  } catch (error) {
    console.error('[VERIFY_STATUS] Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});