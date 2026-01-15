import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  // FASE 1 - PROVA DE DEPLOY (PRIMEIRA LINHA)
  const PATH = new URL(req.url).pathname;
  console.log(`[PROOF] CODE_VERSION=FIX_CLONE_429_2026_01_14 PATH=${PATH} TS=${new Date().toISOString()}`);

  // ENDPOINT DE HEALTH
  if (req.headers.get('x-proof') === '1') {
    return Response.json({ ok: true, code_version: "FIX_CLONE_429_2026_01_14", path: PATH, ts: new Date().toISOString() });
  }

  // Ler body UMA ÚNICA VEZ (NUNCA CLONE)
  const bodyText = await req.text();
  const body = bodyText ? JSON.parse(bodyText) : {};
  const integrationIdForCatch = body?.integration_id;

  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const integration_id = body?.integration_id;

    if (!integration_id) {
      return Response.json({ error: 'integration_id is required' }, { status: 400 });
    }

    console.log(`[RESET_INTEGRATION] Resetting integration ${integration_id}`);

    // Buscar integração
    let allIntegrations = [];
    let skip = 0;
    const limit = 5000;
    let hasMore = true;
    
    while (hasMore) {
      const batch = await base44.asServiceRole.entities.Integration.list(null, limit, skip);
      allIntegrations = allIntegrations.concat(batch);
      skip += limit;
      hasMore = batch.length === limit;
    }
    
    const integration = allIntegrations.find(i => i.id === integration_id);

    if (!integration) {
      return Response.json({ error: 'Integration not found' }, { status: 404 });
    }

    const storeId = integration.store_id;

    // Marcar integração como resetando
    await base44.asServiceRole.entities.Integration.update(integration.id, {
      sync_status: 'running',
      sync_stage: 'Resetando dados...',
      status: 'syncing',
      sync_cancel_requested: true,
      sync_run_id: null
    });

    console.log('[RESET_INTEGRATION] Step 1: Deleting OrderItems...');
    
    // Deletar OrderItems em lotes
    let deletedOrderItems = 0;
    hasMore = true;
    while (hasMore) {
      const orders = await base44.asServiceRole.entities.Order.filter(
        { store_id: storeId },
        null,
        500,
        0
      );
      
      if (orders.length === 0) break;
      
      for (const order of orders) {
        const items = await base44.asServiceRole.entities.OrderItem.filter(
          { order_id: order.id },
          null,
          500,
          0
        );
        
        for (const item of items) {
          await base44.asServiceRole.entities.OrderItem.delete(item.id);
          deletedOrderItems++;
        }
      }
      
      hasMore = orders.length === 500;
    }
    
    console.log(`[RESET_INTEGRATION] Deleted ${deletedOrderItems} OrderItems`);

    // Atualizar progresso
    await base44.asServiceRole.entities.Integration.update(integration.id, {
      sync_stage: 'Deletando pedidos...'
    });

    console.log('[RESET_INTEGRATION] Step 2: Deleting Orders...');
    
    // Deletar Orders em lotes
    let deletedOrders = 0;
    hasMore = true;
    while (hasMore) {
      const orders = await base44.asServiceRole.entities.Order.filter(
        { store_id: storeId },
        null,
        500,
        0
      );
      
      if (orders.length === 0) break;
      
      for (const order of orders) {
        await base44.asServiceRole.entities.Order.delete(order.id);
        deletedOrders++;
      }
      
      hasMore = orders.length === 500;
    }
    
    console.log(`[RESET_INTEGRATION] Deleted ${deletedOrders} Orders`);

    // Atualizar progresso
    await base44.asServiceRole.entities.Integration.update(integration.id, {
      sync_stage: 'Deletando clientes...'
    });

    console.log('[RESET_INTEGRATION] Step 3: Deleting Customers...');
    
    // Deletar Customers em lotes
    let deletedCustomers = 0;
    hasMore = true;
    while (hasMore) {
      const customers = await base44.asServiceRole.entities.Customer.filter(
        { store_id: storeId },
        null,
        500,
        0
      );
      
      if (customers.length === 0) break;
      
      for (const customer of customers) {
        await base44.asServiceRole.entities.Customer.delete(customer.id);
        deletedCustomers++;
      }
      
      hasMore = customers.length === 500;
    }
    
    console.log(`[RESET_INTEGRATION] Deleted ${deletedCustomers} Customers`);

    // Atualizar progresso
    await base44.asServiceRole.entities.Integration.update(integration.id, {
      sync_stage: 'Deletando produtos...'
    });

    console.log('[RESET_INTEGRATION] Step 4: Deleting Products...');
    
    // Deletar Products em lotes
    let deletedProducts = 0;
    hasMore = true;
    while (hasMore) {
      const products = await base44.asServiceRole.entities.Product.filter(
        { store_id: storeId },
        null,
        500,
        0
      );
      
      if (products.length === 0) break;
      
      for (const product of products) {
        await base44.asServiceRole.entities.Product.delete(product.id);
        deletedProducts++;
      }
      
      hasMore = products.length === 500;
    }
    
    console.log(`[RESET_INTEGRATION] Deleted ${deletedProducts} Products`);

    // Atualizar progresso
    await base44.asServiceRole.entities.Integration.update(integration.id, {
      sync_stage: 'Deletando análises...'
    });

    console.log('[RESET_INTEGRATION] Step 5: Deleting RFM Analysis...');
    
    // Deletar RFM Analysis
    let deletedRFM = 0;
    hasMore = true;
    while (hasMore) {
      const rfmAnalysis = await base44.asServiceRole.entities.RFMAnalysis.filter(
        { store_id: storeId },
        null,
        500,
        0
      );
      
      if (rfmAnalysis.length === 0) break;
      
      for (const rfm of rfmAnalysis) {
        await base44.asServiceRole.entities.RFMAnalysis.delete(rfm.id);
        deletedRFM++;
      }
      
      hasMore = rfmAnalysis.length === 500;
    }
    
    console.log(`[RESET_INTEGRATION] Deleted ${deletedRFM} RFM Analysis`);

    console.log('[RESET_INTEGRATION] Step 6: Deleting ABC Analysis...');
    
    // Deletar ABC Analysis
    let deletedABC = 0;
    hasMore = true;
    while (hasMore) {
      const abcAnalysis = await base44.asServiceRole.entities.ABCAnalysis.filter(
        { store_id: storeId },
        null,
        500,
        0
      );
      
      if (abcAnalysis.length === 0) break;
      
      for (const abc of abcAnalysis) {
        await base44.asServiceRole.entities.ABCAnalysis.delete(abc.id);
        deletedABC++;
      }
      
      hasMore = abcAnalysis.length === 500;
    }
    
    console.log(`[RESET_INTEGRATION] Deleted ${deletedABC} ABC Analysis`);

    // Limpar integração para estado "novo"
    console.log('[RESET_INTEGRATION] Step 7: Resetting integration state...');
    
    await base44.asServiceRole.entities.Integration.update(integration.id, {
      api_key: null,
      nuvemshop_store_id: null,
      oauth_state: null,
      status: 'disconnected',
      sync_status: 'idle',
      sync_stage: null,
      sync_progress_percent: 0,
      sync_total_pages: 0,
      sync_processed_pages: 0,
      sync_current_page: 0,
      sync_cursor_page: 1,
      sync_cursor_url: null,
      sync_next_url: null,
      sync_total_imported: 0,
      sync_total_imported_paid: 0,
      initial_sync_completed: false,
      sync_error_message: null,
      sync_cancel_requested: false,
      sync_run_id: null,
      sync_cancelled_at: null,
      sync_started_at: null,
      sync_finished_at: null,
      last_sync: null,
      webhook_registered: false,
      webhook_id: null,
      webhook_url: null,
      webhook_events: null,
      webhook_created_at: null,
      last_event_at: null
    });

    console.log('[RESET_INTEGRATION] ====================================');
    console.log('[RESET_INTEGRATION] === RESET COMPLETED SUCCESSFULLY ===');
    console.log(`[RESET_INTEGRATION] Deleted:`);
    console.log(`[RESET_INTEGRATION]   - OrderItems: ${deletedOrderItems}`);
    console.log(`[RESET_INTEGRATION]   - Orders: ${deletedOrders}`);
    console.log(`[RESET_INTEGRATION]   - Customers: ${deletedCustomers}`);
    console.log(`[RESET_INTEGRATION]   - Products: ${deletedProducts}`);
    console.log(`[RESET_INTEGRATION]   - RFM Analysis: ${deletedRFM}`);
    console.log(`[RESET_INTEGRATION]   - ABC Analysis: ${deletedABC}`);
    console.log('[RESET_INTEGRATION] Integration state reset to disconnected');
    console.log('[RESET_INTEGRATION] User can now reconnect from scratch');

    return Response.json({ 
      success: true,
      message: 'Integração resetada com sucesso',
      deleted: {
        order_items: deletedOrderItems,
        orders: deletedOrders,
        customers: deletedCustomers,
        products: deletedProducts,
        rfm_analysis: deletedRFM,
        abc_analysis: deletedABC
      }
    });

  } catch (error) {
    console.error('[RESET_INTEGRATION] Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});