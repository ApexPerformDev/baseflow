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
  
  // Criar novo Request com body já lido para evitar erro de clone
  const newReq = new Request(req.url, {
    method: req.method,
    headers: req.headers,
    body: (req.method !== 'GET' && req.method !== 'HEAD' && bodyText) ? bodyText : undefined
  });
  const base44 = createClientFromRequest(newReq);
  
  try {
    const storeIdFilter = body?.store_id;

    // Buscar todas as integrações Nuvemshop conectadas
    const allIntegrations = await base44.asServiceRole.entities.Integration.list();
    const nuvemshopIntegrations = allIntegrations.filter(i => 
      i.integration_type === 'NUVEMSHOP' && 
      (i.status === 'connected' || i.status === 'syncing') &&
      (!storeIdFilter || i.store_id === storeIdFilter)
    );
    
    console.log(`[SYNC] Found ${nuvemshopIntegrations.length} Nuvemshop integrations to sync`, {
      storeIdFilter,
      totalIntegrations: allIntegrations.length,
      filteredIntegrations: nuvemshopIntegrations.map(i => ({
        id: i.id,
        store_id: i.store_id,
        status: i.status,
        initial_sync_completed: i.initial_sync_completed
      }))
    });

    const results = [];

    for (const integration of nuvemshopIntegrations) {
      try {
        // Atualizar status
        await base44.asServiceRole.entities.Integration.update(integration.id, {
          status: 'syncing',
          sync_status: 'Sincronizando...'
        });

        const accessToken = integration.api_key;
        const nuvemshopStoreId = integration.store_url;

        console.log(`[SYNC] Starting sync for store ${integration.store_id}, Nuvemshop ID: ${nuvemshopStoreId}`, {
          integration_id: integration.id,
          has_token: !!accessToken,
          token_length: accessToken?.length,
          token_preview: accessToken ? `${accessToken.substring(0, 6)}...${accessToken.substring(accessToken.length - 6)}` : 'N/A'
        });

        // Validar token antes de iniciar sync
        console.log('[SYNC] Validating token before sync...');
        const validateResponse = await fetch(
          `https://api.nuvemshop.com.br/v1/${nuvemshopStoreId}/store`,
          {
            headers: {
              'Authentication': `bearer ${accessToken}`,
              'User-Agent': 'Baseflow (contato@baseflow.com.br)',
              'Accept': 'application/json'
            }
          }
        );

        if (!validateResponse.ok) {
          const errorBody = await validateResponse.text();
          console.error('[SYNC] Token validation FAILED:', {
            status: validateResponse.status,
            error: errorBody
          });

          await base44.asServiceRole.entities.Integration.update(integration.id, {
            status: 'error',
            sync_status: 'error',
            sync_error_message: `Token inválido (${validateResponse.status}). Reconecte a integração.`
          });

          results.push({
            store_id: integration.store_id,
            success: false,
            status: 'error',
            message: `Token inválido (${validateResponse.status}). Reconecte a integração.`,
            error: 'Invalid access token'
          });
          continue;
        }

        console.log('[SYNC] Token validated successfully');

        if (!accessToken || !nuvemshopStoreId) {
          console.error('[SYNC] Missing token or store ID:', {
            has_token: !!accessToken,
            has_store_id: !!nuvemshopStoreId
          });

          await base44.asServiceRole.entities.Integration.update(integration.id, {
            status: 'error',
            sync_status: 'error',
            sync_error_message: 'Token de acesso ou ID da loja não encontrado. Reconecte a integração.'
          });

          results.push({
            store_id: integration.store_id,
            success: false,
            status: 'error',
            message: 'Token de acesso ou ID da loja não encontrado. Reconecte a integração.',
            error: 'Missing credentials'
          });
          continue;
        }
        
        // Data da última sincronização
        const lastSync = integration.last_sync ? new Date(integration.last_sync) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const updatedAtMin = lastSync.toISOString();
        
        console.log(`[SYNC] Fetching orders updated after: ${updatedAtMin}`);

        let page = 1;
        let totalOrders = 0;
        let hasMorePages = true;

        while (hasMorePages) {
          // Buscar pedidos atualizados desde última sincronização
          console.log(`[SYNC] Fetching page ${page}...`);
          const ordersResponse = await fetch(
            `https://api.nuvemshop.com.br/v1/${nuvemshopStoreId}/orders?updated_at_min=${updatedAtMin}&page=${page}&per_page=50`,
            {
              headers: {
                'Authentication': `bearer ${accessToken}`,
                'User-Agent': 'Baseflow (contato@baseflow.com.br)',
                'Accept': 'application/json'
              }
            }
            );

            console.log(`[SYNC] API Response status: ${ordersResponse.status}`);

            if (!ordersResponse.ok) {
            const errorText = await ordersResponse.text();
            console.error(`[SYNC] API Error ${ordersResponse.status}:`, errorText);

            // Paginação vazia não é erro - apenas finalizar
            if (ordersResponse.status === 404 && (errorText.includes('Last page is 0') || errorText.includes('Not Found'))) {
              console.log('[SYNC] No orders found (empty pagination) - treating as success with 0 orders');
              hasMorePages = false;
              break;
            }

            let errorMessage = `Erro ao buscar pedidos: ${ordersResponse.status}`;

            if (ordersResponse.status === 401) {
              errorMessage = 'Token de acesso inválido. Por favor, reconecte a integração com a Nuvemshop.';
            } else if (ordersResponse.status === 403) {
              errorMessage = 'Acesso negado pela Nuvemshop. Verifique as permissões do app.';
            }

            // NÃO DESCONECTAR - manter connected, apenas marcar erro
            await base44.asServiceRole.entities.Integration.update(integration.id, {
              sync_status: 'error',
              sync_error_message: errorMessage
            });

            throw new Error(`${errorMessage} - ${errorText}`);
          }

          const orders = await ordersResponse.json();
          console.log(`[SYNC] Received ${orders.length} orders from page ${page}`);

          if (orders.length === 0) {
            console.log('[SYNC] No more orders, stopping pagination');
            hasMorePages = false;
            break;
          }

          // Processar cada pedido (mesmo código da initial sync)
          for (const order of orders) {
            console.log(`[SYNC] Processing order #${order.id}, status: ${order.payment_status}`);
            if (order.payment_status !== 'paid') continue;

            const customer = order.customer;
            if (customer) {
              const existingCustomers = await base44.asServiceRole.entities.Customer.filter({
                store_id: integration.store_id,
                external_id: customer.id.toString()
              });

              const customerData = {
                store_id: integration.store_id,
                external_id: customer.id.toString(),
                name: customer.name || customer.email,
                email: customer.email,
                phone: customer.phone || '',
                city: order.shipping_address?.city || '',
                state: order.shipping_address?.province || '',
                registration_date: customer.created_at?.split('T')[0] || new Date().toISOString().split('T')[0]
              };

              let customerId;
              if (existingCustomers.length > 0) {
                await base44.asServiceRole.entities.Customer.update(existingCustomers[0].id, customerData);
                customerId = existingCustomers[0].id;
              } else {
                const newCustomer = await base44.asServiceRole.entities.Customer.create(customerData);
                customerId = newCustomer.id;
              }

              const existingOrders = await base44.asServiceRole.entities.Order.filter({
                store_id: integration.store_id,
                external_id: order.id.toString()
              });

              const orderData = {
                store_id: integration.store_id,
                customer_id: customerId,
                external_id: order.id.toString(),
                order_date: order.created_at,
                status: 'paid',
                total_amount: parseFloat(order.total)
              };

              let orderId;
              if (existingOrders.length > 0) {
                await base44.asServiceRole.entities.Order.update(existingOrders[0].id, orderData);
                orderId = existingOrders[0].id;
              } else {
                const newOrder = await base44.asServiceRole.entities.Order.create(orderData);
                orderId = newOrder.id;
              }

              for (const item of order.products || []) {
                const existingProducts = await base44.asServiceRole.entities.Product.filter({
                  store_id: integration.store_id,
                  external_id: item.product_id.toString()
                });

                const productData = {
                  store_id: integration.store_id,
                  external_id: item.product_id.toString(),
                  sku: item.sku || '',
                  name: item.name,
                  category: item.category || '',
                  price: parseFloat(item.price)
                };

                let productId;
                if (existingProducts.length > 0) {
                  await base44.asServiceRole.entities.Product.update(existingProducts[0].id, productData);
                  productId = existingProducts[0].id;
                } else {
                  const newProduct = await base44.asServiceRole.entities.Product.create(productData);
                  productId = newProduct.id;
                }

                const existingOrderItems = await base44.asServiceRole.entities.OrderItem.filter({
                  order_id: orderId,
                  product_id: productId
                });

                const orderItemData = {
                  order_id: orderId,
                  product_id: productId,
                  quantity: item.quantity,
                  unit_price: parseFloat(item.price),
                  total_price: parseFloat(item.price) * item.quantity
                };

                if (existingOrderItems.length > 0) {
                  await base44.asServiceRole.entities.OrderItem.update(existingOrderItems[0].id, orderItemData);
                } else {
                  await base44.asServiceRole.entities.OrderItem.create(orderItemData);
                }
              }
            }

            totalOrders++;
          }

          page++;
          if (orders.length < 50) {
            hasMorePages = false;
          }
        }

        console.log(`[SYNC] Sync completed for store ${integration.store_id}: ${totalOrders} orders processed`);
        
        // Contar registros criados/atualizados
        const ordersCount = await base44.asServiceRole.entities.Order.filter({ store_id: integration.store_id });
        const customersCount = await base44.asServiceRole.entities.Customer.filter({ store_id: integration.store_id });
        const productsCount = await base44.asServiceRole.entities.Product.filter({ store_id: integration.store_id });
        const itemsCount = await base44.asServiceRole.entities.OrderItem.list();
        const storeItems = itemsCount.filter(item => {
          const order = ordersCount.find(o => o.id === item.order_id);
          return order !== undefined;
        });
        
        console.log(`[SYNC] Current counts - Orders: ${ordersCount.length}, Customers: ${customersCount.length}, Products: ${productsCount.length}, Items: ${storeItems.length}`);
        
        const now = new Date().toISOString();
        
        // Atualizar integração
        console.log(`[SYNC] Updating integration - Orders processed: ${totalOrders}, DB totals: Orders ${ordersCount.length}, Customers ${customersCount.length}, Products ${productsCount.length}`);
        
        await base44.asServiceRole.entities.Integration.update(integration.id, {
          status: 'connected',
          sync_status: totalOrders > 0 ? `${totalOrders} pedidos sincronizados` : 'Sincronizado (0 novos pedidos)',
          last_sync: now,
          sync_error_message: null,
          initial_sync_completed: true
        });

        // Recalcular métricas
        try {
          console.log(`[SYNC] Recalculating metrics for store ${integration.store_id}...`);
          await base44.asServiceRole.functions.invoke('calculateRFM', { store_id: integration.store_id });
          await base44.asServiceRole.functions.invoke('calculateABC', { store_id: integration.store_id });
          console.log(`[SYNC] Metrics calculated successfully`);
        } catch (error) {
          console.error('[SYNC] Error calculating metrics:', error);
        }

        results.push({
          store_id: integration.store_id,
          success: true,
          status: 'success',
          message: `${totalOrders} pedidos sincronizados com sucesso`,
          ordersImported: totalOrders,
          customersImported: customersCount.length,
          productsImported: productsCount.length,
          itemsImported: storeItems.length,
          lastSyncAt: now,
          totalOrdersInDB: ordersCount.length,
          totalCustomersInDB: customersCount.length,
          totalProductsInDB: productsCount.length
        });

      } catch (error) {
        console.error(`[SYNC] Error syncing store ${integration.store_id}:`, error);
        
        await base44.asServiceRole.entities.Integration.update(integration.id, {
          status: 'error',
          sync_status: 'error',
          sync_error_message: error.message
        });

        results.push({
          store_id: integration.store_id,
          success: false,
          error: error.message
        });
      }
    }

    console.log('[SYNC] All stores processed:', results);

    if (results.length === 0) {
      return Response.json({ 
        success: false,
        status: 'error',
        message: 'Nenhuma integração encontrada para sincronizar',
        ordersImported: 0,
        customersImported: 0,
        productsImported: 0
      });
    }

    // Retornar resultado da primeira (e geralmente única) loja
    const result = results[0];
    return Response.json({ 
      success: result.success,
      status: result.status,
      message: result.message,
      ordersImported: result.ordersImported,
      customersImported: result.customersImported,
      productsImported: result.productsImported,
      itemsImported: result.itemsImported,
      lastSyncAt: result.lastSyncAt,
      totalOrdersInDB: result.totalOrdersInDB,
      totalCustomersInDB: result.totalCustomersInDB,
      totalProductsInDB: result.totalProductsInDB,
      allResults: results
    });

  } catch (error) {
    console.error('Error in nuvemshopSync:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});