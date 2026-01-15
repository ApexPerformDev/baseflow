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
  const webhookData = bodyText ? JSON.parse(bodyText) : {};

  // Criar novo Request com body já lido para evitar erro de clone
  const newReq = new Request(req.url, {
    method: req.method,
    headers: req.headers,
    body: (req.method !== 'GET' && req.method !== 'HEAD' && bodyText) ? bodyText : undefined
  });
  const base44 = createClientFromRequest(newReq);

  try {
    console.log('[WEBHOOK] Received webhook:', JSON.stringify(webhookData, null, 2));
    
    const { store_id, event, id } = webhookData;
    
    if (!store_id || !event) {
      console.error('[WEBHOOK] Missing store_id or event');
      return Response.json({ error: 'Missing store_id or event' }, { status: 400 });
    }
    
    console.log(`[WEBHOOK] Processing event ${event} for store ${store_id}`);
    
    // Find integration for this store
    const allIntegrations = await base44.asServiceRole.entities.Integration.list();
    const integration = allIntegrations.find(i => 
      i.integration_type === 'NUVEMSHOP' && 
      (i.nuvemshop_store_id === store_id.toString() || i.store_url === store_id.toString()) &&
      i.status === 'connected'
    );
    
    if (!integration) {
      console.log('[WEBHOOK] No active integration found for store:', store_id);
      return Response.json({ error: 'Integration not found' }, { status: 404 });
    }
    
    console.log(`[WEBHOOK] Found integration ${integration.id} for store ${integration.store_id}`);
    
    // Handle only order events (order/created, order/paid, order/updated)
    if (!event.startsWith('order/')) {
      console.log('[WEBHOOK] Ignoring non-order event:', event);
      return Response.json({ success: true, message: 'Event ignored' });
    }
    
    const orderId = id;
    
    if (!orderId) {
      console.error('[WEBHOOK] Missing order ID');
      return Response.json({ error: 'Missing order ID' }, { status: 400 });
    }
    
    console.log(`[WEBHOOK] Processing order ${orderId}`);
    
    // Fetch full order details from Nuvemshop API
    const accessToken = integration.api_key;
    const nuvemshopStoreId = integration.nuvemshop_store_id || integration.store_url;
    
    const orderResponse = await fetch(
      `https://api.nuvemshop.com.br/v1/${nuvemshopStoreId}/orders/${orderId}`,
      {
        headers: {
          'Authentication': `bearer ${accessToken}`,
          'User-Agent': 'Baseflow (contato@baseflow.com.br)',
          'Accept': 'application/json'
        }
      }
    );
    
    if (!orderResponse.ok) {
      console.error(`[WEBHOOK] Failed to fetch order: ${orderResponse.status}`);
      return Response.json({ error: 'Failed to fetch order' }, { status: 500 });
    }
    
    const order = await orderResponse.json();
    console.log(`[WEBHOOK] Order fetched successfully. Payment status: ${order.payment_status}`);
    
    // Only process paid orders
    if (order.payment_status !== 'paid') {
      console.log('[WEBHOOK] Order not paid yet, skipping:', orderId);
      return Response.json({ success: true, message: 'Order not paid yet' });
    }
    
    // Process customer
    const customer = order.customer;
    if (!customer) {
      console.log('[WEBHOOK] No customer data in order, skipping');
      return Response.json({ success: true, message: 'No customer data' });
    }
    
    console.log(`[WEBHOOK] Processing customer ${customer.id}`);
    
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
      console.log(`[WEBHOOK] Customer updated: ${customerId}`);
    } else {
      const newCustomer = await base44.asServiceRole.entities.Customer.create(customerData);
      customerId = newCustomer.id;
      console.log(`[WEBHOOK] Customer created: ${customerId}`);
    }
    
    // Process order (idempotent - check if already exists)
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
    
    let dbOrderId;
    if (existingOrders.length > 0) {
      await base44.asServiceRole.entities.Order.update(existingOrders[0].id, orderData);
      dbOrderId = existingOrders[0].id;
      console.log(`[WEBHOOK] Order updated: ${dbOrderId}`);
    } else {
      const newOrder = await base44.asServiceRole.entities.Order.create(orderData);
      dbOrderId = newOrder.id;
      console.log(`[WEBHOOK] Order created: ${dbOrderId}`);
    }
    
    // Process order items
    console.log(`[WEBHOOK] Processing ${order.products?.length || 0} order items`);
    
    for (const item of order.products || []) {
      // Process product (idempotent)
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
      
      // Process order item (idempotent - check by order_id + product_id)
      const existingOrderItems = await base44.asServiceRole.entities.OrderItem.filter({
        order_id: dbOrderId,
        product_id: productId
      });
      
      const orderItemData = {
        order_id: dbOrderId,
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
    
    // Update last_event_at on integration
    await base44.asServiceRole.entities.Integration.update(integration.id, {
      last_event_at: new Date().toISOString()
    });
    
    console.log(`[WEBHOOK] Triggering RFM and ABC recalculation for store ${integration.store_id}`);
    
    // Recalculate RFM and ABC in background (don't wait)
    base44.asServiceRole.functions.invoke('calculateRFM', { 
      store_id: integration.store_id
    }).catch(err => console.error('[WEBHOOK] Error calculating RFM:', err));
    
    base44.asServiceRole.functions.invoke('calculateABC', { 
      store_id: integration.store_id
    }).catch(err => console.error('[WEBHOOK] Error calculating ABC:', err));
    
    console.log(`[WEBHOOK] Order ${orderId} processed successfully`);
    
    return Response.json({ 
      success: true, 
      message: 'Order processed successfully',
      order_id: orderId,
      customer_id: customerId
    });
    
  } catch (error) {
    console.error('[WEBHOOK] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});