import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { base44CallWithRetry, sleep } from './_rateLimit.js';

const CODE_VERSION = "FIX_CLONE_429_2026_01_14";
const BATCH_SIZE = 5;
const REINVOKE_DELAY_MS = 10000;

Deno.serve(async (req) => {
  // FASE 1 - PROVA DE DEPLOY (PRIMEIRA LINHA)
  const PATH = new URL(req.url).pathname;
  console.log(`[PROOF] CODE_VERSION=${CODE_VERSION} PATH=${PATH} TS=${new Date().toISOString()}`);

  // ENDPOINT DE HEALTH
  if (req.headers.get('x-proof') === '1') {
    return Response.json({ ok: true, code_version: CODE_VERSION, path: PATH, ts: new Date().toISOString() });
  }

  // LER BODY UMA VEZ (NUNCA CLONE)
  const bodyText = await req.text();
  const body = bodyText ? JSON.parse(bodyText) : {};
  const integrationIdForCatch = body?.integration_id;

  // Criar novo Request com body já lido para evitar erro de clone
  const newReq = new Request(req.url, {
    method: req.method,
    headers: req.headers,
    body: (req.method !== 'GET' && req.method !== 'HEAD' && bodyText) ? bodyText : undefined
  });
  const base44 = createClientFromRequest(newReq);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const integration_id = body?.integration_id;
    if (!integration_id) return Response.json({ error: 'integration_id is required' }, { status: 400 });

    const integrations = await base44CallWithRetry(() =>
      base44.asServiceRole.entities.Integration.filter({ id: integration_id })
    );
    const integration = integrations[0];

    if (!integration) return Response.json({ error: 'Integration not found' }, { status: 404 });

    if (integration.sync_cancel_requested) {
      await base44CallWithRetry(() =>
        base44.asServiceRole.entities.Integration.update(integration.id, {
          status: 'connected',
          sync_status: 'idle',
          sync_phase: null,
          sync_stage: 'Cancelado',
          sync_run_id: null,
          sync_cancel_requested: false
        })
      );
      return Response.json({ success: false, cancelled: true });
    }

    const rawPages = await base44CallWithRetry(() =>
      base44.asServiceRole.entities.NuvemshopOrdersRawPage.filter({ integration_id: integration.id, processed: false })
    );

    if (rawPages.length === 0) {
      const now = new Date().toISOString();
      await base44CallWithRetry(() =>
        base44.asServiceRole.entities.Integration.update(integration.id, {
          status: 'connected',
          sync_status: 'idle',
          sync_phase: null,
          sync_progress_percent: 100,
          sync_stage: 'Concluído',
          sync_finished_at: now,
          last_sync: now,
          initial_sync_completed: true,
          sync_run_id: null
        })
      );

      try {
        await base44CallWithRetry(() =>
          base44.asServiceRole.functions.invoke('calculateRFM', { store_id: integration.store_id, period_days: 365 })
        );
        await base44CallWithRetry(() =>
          base44.asServiceRole.functions.invoke('calculateABC', { store_id: integration.store_id, period_days: 365 })
        );
      } catch (error) {
        console.error('[PROCESS_RAW] Metrics error:', error.message);
      }

      return Response.json({ success: true, completed: true, message: 'Sincronização completa' });
    }

    const rawPage = rawPages[0];
    const orders = JSON.parse(rawPage.payload_json);

    const allCustomers = await base44CallWithRetry(() =>
      base44.asServiceRole.entities.Customer.filter({ store_id: integration.store_id })
    );
    const customerExternalMap = new Map(allCustomers.map(c => [c.external_id, c.id]));
    
    const allProducts = await base44CallWithRetry(() =>
      base44.asServiceRole.entities.Product.filter({ store_id: integration.store_id })
    );
    const productExternalMap = new Map(allProducts.map(p => [p.external_id, p.id]));
    
    const allOrders = await base44CallWithRetry(() =>
      base44.asServiceRole.entities.Order.filter({ store_id: integration.store_id })
    );
    const orderExternalMap = new Map(allOrders.map(o => [o.external_id, o.id]));

    let paidProcessed = 0;

    for (let i = 0; i < orders.length; i += BATCH_SIZE) {
      const batch = orders.slice(i, i + BATCH_SIZE);
      for (const order of batch) {
        try {
          if (order.payment_status !== 'paid') continue;
          const customer = order.customer;
          if (!customer) continue;

          let customerId = customerExternalMap.get(customer.id.toString());
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

          if (customerId) {
            await base44CallWithRetry(() =>
              base44.asServiceRole.entities.Customer.update(customerId, customerData)
            );
          } else {
            const newCustomer = await base44CallWithRetry(() =>
              base44.asServiceRole.entities.Customer.create(customerData)
            );
            customerId = newCustomer.id;
            customerExternalMap.set(customer.id.toString(), customerId);
          }

          let orderId = orderExternalMap.get(order.id.toString());
          const orderData = {
            store_id: integration.store_id,
            customer_id: customerId,
            external_id: order.id.toString(),
            order_date: order.created_at,
            status: 'paid',
            total_amount: parseFloat(order.total)
          };

          if (orderId) {
            await base44CallWithRetry(() =>
              base44.asServiceRole.entities.Order.update(orderId, orderData)
            );
          } else {
            const newOrder = await base44CallWithRetry(() =>
              base44.asServiceRole.entities.Order.create(orderData)
            );
            orderId = newOrder.id;
            orderExternalMap.set(order.id.toString(), orderId);
          }

          for (const item of order.products || []) {
            let productId = productExternalMap.get(item.product_id.toString());
            const productData = {
              store_id: integration.store_id,
              external_id: item.product_id.toString(),
              sku: item.sku || '',
              name: item.name,
              category: item.category || '',
              price: parseFloat(item.price)
            };

            if (productId) {
              await base44CallWithRetry(() =>
                base44.asServiceRole.entities.Product.update(productId, productData)
              );
            } else {
              const newProduct = await base44CallWithRetry(() =>
                base44.asServiceRole.entities.Product.create(productData)
              );
              productId = newProduct.id;
              productExternalMap.set(item.product_id.toString(), productId);
            }

            const orderItemExternalId = `${order.id}:${item.product_id}`;
            const orderItemData = {
              order_id: orderId,
              product_id: productId,
              external_id: orderItemExternalId,
              quantity: item.quantity,
              unit_price: parseFloat(item.price),
              total_price: parseFloat(item.price) * item.quantity
            };

            try {
              await base44CallWithRetry(() =>
                base44.asServiceRole.entities.OrderItem.create(orderItemData)
              );
            } catch (error) {
              if (error.message?.includes('duplicate')) {
                const existing = await base44CallWithRetry(() =>
                  base44.asServiceRole.entities.OrderItem.filter({ external_id: orderItemExternalId })
                );
                if (existing.length > 0) {
                  await base44CallWithRetry(() =>
                    base44.asServiceRole.entities.OrderItem.update(existing[0].id, orderItemData)
                  );
                }
              } else {
                throw error;
              }
            }
          }

          paidProcessed++;
        } catch (error) {
          console.error(`[PROCESS_RAW] Error on order ${order.id}:`, error.message);
        }
      }
    }

    await base44CallWithRetry(() =>
      base44.asServiceRole.entities.NuvemshopOrdersRawPage.update(rawPage.id, {
        processed: true,
        processed_at: new Date().toISOString()
      })
    );

    const allRawPages = await base44CallWithRetry(() =>
      base44.asServiceRole.entities.NuvemshopOrdersRawPage.filter({ integration_id: integration.id })
    );
    
    const totalPages = allRawPages.length;
    const processedCount = allRawPages.filter(p => p.processed).length;
    const progressPercent = totalPages > 0 ? Math.min(99, 50 + Math.floor((processedCount / totalPages) * 50)) : 95;
    const totalPaidProcessed = (integration.sync_total_imported_paid || 0) + paidProcessed;

    await base44CallWithRetry(() =>
      base44.asServiceRole.entities.Integration.update(integration.id, {
        sync_progress_percent: progressPercent,
        sync_stage: `Processando pedidos (2/2) | Página ${processedCount}/${totalPages} | Importados: ${totalPaidProcessed}`,
        sync_total_imported_paid: totalPaidProcessed
      })
    );

    await sleep(REINVOKE_DELAY_MS);
    base44.asServiceRole.functions.invoke('nuvemshopProcessRawOrders', { integration_id })
      .catch(err => console.error('[PROCESS_RAW] Reinvoke error:', err));

    return Response.json({
      success: true,
      continuing: true,
      phase: 2,
      page_processed: rawPage.page,
      paid_processed: paidProcessed,
      remaining_pages: totalPages - processedCount
    });

  } catch (error) {
    console.error('[PROCESS_RAW] FATAL ERROR:', error.message);

    if (integrationIdForCatch) {
      try {
        await base44CallWithRetry(() =>
          base44.asServiceRole.entities.Integration.update(integrationIdForCatch, {
            status: 'error',
            sync_status: 'error',
            sync_phase: null,
            sync_error_message: error.message?.slice(0, 500) || 'Erro desconhecido',
            sync_run_id: null
          })
        );
      } catch (updateErr) {
        console.error('[PROCESS_RAW] Error updating error status:', updateErr.message);
      }
    }

    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});