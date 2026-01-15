import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
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
    const store_id = body?.store_id;
    const period_days = body?.period_days || 365;

    if (!store_id) {
      return Response.json({ error: 'store_id is required' }, { status: 400 });
    }

    console.log(`[ABC] Starting ABC calculation for store ${store_id}, period: ${period_days} days`);

    // Data de corte
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - period_days);

    // Buscar dados
    const allOrders = await base44.asServiceRole.entities.Order.list();
    const allOrderItems = await base44.asServiceRole.entities.OrderItem.list();
    const allProducts = await base44.asServiceRole.entities.Product.list();

    // Filtrar por store
    const storeOrders = allOrders.filter(o => 
      o.store_id === store_id && 
      o.status === 'paid' &&
      new Date(o.order_date) >= cutoffDate
    );

    console.log(`[ABC] Found ${storeOrders.length} paid orders in period`);

    // Deduplicar pedidos
    const uniqueOrdersMap = new Map();
    for (const order of storeOrders) {
      const key = order.external_id;
      if (!uniqueOrdersMap.has(key) || 
          new Date(order.updated_date) > new Date(uniqueOrdersMap.get(key).updated_date)) {
        uniqueOrdersMap.set(key, order);
      }
    }
    const uniqueOrders = Array.from(uniqueOrdersMap.values());
    const orderIds = uniqueOrders.map(o => o.id);

    // Buscar itens dos pedidos válidos
    const orderItems = allOrderItems.filter(item => orderIds.includes(item.order_id));

    console.log(`[ABC] Processing ${orderItems.length} order items`);

    // Agrupar por produto
    const productStats = new Map();

    for (const item of orderItems) {
      const productId = item.product_id;
      
      if (!productStats.has(productId)) {
        productStats.set(productId, {
          product_id: productId,
          quantity_sold: 0,
          total_revenue: 0
        });
      }

      const stats = productStats.get(productId);
      stats.quantity_sold += item.quantity || 0;
      stats.total_revenue += (item.total_price || (item.quantity * item.unit_price)) || 0;
    }

    console.log(`[ABC] Calculated stats for ${productStats.size} products`);

    if (productStats.size === 0) {
      console.log(`[ABC] No products sold in period`);
      return Response.json({ 
        success: true, 
        message: 'No products sold in period',
        products_processed: 0
      });
    }

    // Ordenar por faturamento (maior para menor)
    const sortedProducts = Array.from(productStats.values())
      .sort((a, b) => b.total_revenue - a.total_revenue);

    // Calcular faturamento total
    const totalRevenue = sortedProducts.reduce((sum, p) => sum + p.total_revenue, 0);

    // Calcular percentuais e atribuir classificação ABC
    let accumulated = 0;
    const productsWithABC = sortedProducts.map(product => {
      const revenuePercent = totalRevenue > 0 ? (product.total_revenue / totalRevenue) * 100 : 0;
      accumulated += revenuePercent;

      // Classificar por acumulado: A até 80%, B de 80% a 95%, C acima de 95%
      let group;
      if (accumulated <= 80) {
        group = 'A';
      } else if (accumulated <= 95) {
        group = 'B';
      } else {
        group = 'C';
      }

      return {
        ...product,
        quantity_sold: product.quantity_sold,
        total_revenue: product.total_revenue,
        revenue_percentage: revenuePercent,
        accumulated_percentage: accumulated,
        group_abc: group
      };
    });

    console.log(`[ABC] Assigned ABC groups`);

    // Salvar/atualizar na entidade ABCAnalysis
    const periodStart = cutoffDate.toISOString().split('T')[0];
    const periodEnd = new Date().toISOString().split('T')[0];

    let created = 0;
    let updated = 0;

    for (const productData of productsWithABC) {
      // Buscar registro existente
      const existing = await base44.asServiceRole.entities.ABCAnalysis.filter({
        store_id: store_id,
        product_id: productData.product_id
      });

      const abcData = {
        store_id: store_id,
        product_id: productData.product_id,
        group_abc: productData.group_abc,
        quantity_sold: productData.quantity_sold,
        total_revenue: productData.total_revenue,
        revenue_percentage: productData.revenue_percentage,
        accumulated_percentage: productData.accumulated_percentage,
        period_start: periodStart,
        period_end: periodEnd
      };

      if (existing.length > 0) {
        await base44.asServiceRole.entities.ABCAnalysis.update(existing[0].id, abcData);
        updated++;
      } else {
        await base44.asServiceRole.entities.ABCAnalysis.create(abcData);
        created++;
      }
    }

    console.log(`[ABC] Completed - Created: ${created}, Updated: ${updated}`);

    return Response.json({ 
      success: true, 
      message: 'ABC calculation completed',
      products_processed: productStats.size,
      created: created,
      updated: updated
    });

  } catch (error) {
    console.error('[ABC] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});