import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
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

    console.log('[DEBUG_COUNTS] Counting data for store:', store_id);

    // Buscar integração
    const integrations = await base44.asServiceRole.entities.Integration.filter({
      store_id,
      integration_type: 'NUVEMSHOP'
    });

    // Contar registros no banco para esta loja
    const orders = await base44.asServiceRole.entities.Order.filter({ store_id });
    const customers = await base44.asServiceRole.entities.Customer.filter({ store_id });
    const products = await base44.asServiceRole.entities.Product.filter({ store_id });
    
    // Contar itens de pedidos desta loja
    const allItems = await base44.asServiceRole.entities.OrderItem.list();
    const orderIds = orders.map(o => o.id);
    const items = allItems.filter(item => orderIds.includes(item.order_id));

    // Análises
    const rfmAnalysis = await base44.asServiceRole.entities.RFMAnalysis.filter({ store_id });
    const abcAnalysis = await base44.asServiceRole.entities.ABCAnalysis.filter({ store_id });

    // Info da integração
    const integration = integrations[0];
    const lastSync = integration?.last_sync || null;
    const syncStatus = integration?.sync_status || 'N/A';

    // Estatísticas dos pedidos
    const paidOrders = orders.filter(o => o.status === 'paid');
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

    // Últimos registros
    const latestOrders = orders
      .sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime())
      .slice(0, 3);

    const latestCustomers = customers
      .sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())
      .slice(0, 3);

    console.log('[DEBUG_COUNTS] Results:', {
      orders: orders.length,
      customers: customers.length,
      products: products.length,
      items: items.length
    });

    return Response.json({
      success: true,
      store_id,
      integration: {
        found: !!integration,
        status: integration?.status || 'N/A',
        last_sync: lastSync,
        sync_status: syncStatus,
        nuvemshop_store_id: integration?.store_url || 'N/A'
      },
      counts: {
        orders: orders.length,
        customers: customers.length,
        products: products.length,
        order_items: items.length,
        rfm_analysis: rfmAnalysis.length,
        abc_analysis: abcAnalysis.length
      },
      statistics: {
        paid_orders: paidOrders.length,
        total_revenue: totalRevenue.toFixed(2),
        avg_order_value: paidOrders.length > 0 ? (totalRevenue / paidOrders.length).toFixed(2) : '0.00'
      },
      latest_data: {
        orders: latestOrders.map(o => ({
          id: o.external_id,
          date: o.order_date,
          amount: o.total_amount,
          status: o.status
        })),
        customers: latestCustomers.map(c => ({
          name: c.name,
          email: c.email,
          created: c.created_date
        }))
      },
      message: orders.length > 0 
        ? `✅ ${orders.length} pedidos e ${customers.length} clientes encontrados no banco`
        : '⚠️ Nenhum dado encontrado no banco. Execute a sincronização.'
    });

  } catch (error) {
    console.error('[DEBUG_COUNTS] Error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});