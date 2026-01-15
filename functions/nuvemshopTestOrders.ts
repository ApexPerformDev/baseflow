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

    // Buscar integração
    const integrations = await base44.asServiceRole.entities.Integration.filter({
      store_id,
      integration_type: 'NUVEMSHOP'
    });

    if (integrations.length === 0 || integrations[0].status !== 'connected') {
      return Response.json({ error: 'Nuvemshop not connected' }, { status: 400 });
    }

    const integration = integrations[0];
    const accessToken = integration.api_key;
    const nuvemshopStoreId = integration.store_url;

    // Testar API da Nuvemshop
    const ordersResponse = await fetch(
      `https://api.nuvemshop.com.br/v1/${nuvemshopStoreId}/orders?per_page=10`,
      {
        headers: {
          'Authentication': `bearer ${accessToken}`,
          'User-Agent': 'BaseFlow (suporte@baseflow.com.br)',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!ordersResponse.ok) {
      const errorText = await ordersResponse.text();
      console.error('Nuvemshop API error:', errorText);
      return Response.json({ 
        error: 'Failed to fetch orders from Nuvemshop',
        details: errorText 
      }, { status: ordersResponse.status });
    }

    const orders = await ordersResponse.json();

    return Response.json({
      success: true,
      store_id: nuvemshopStoreId,
      orders_count: orders.length,
      orders: orders
    });

  } catch (error) {
    console.error('Error in nuvemshopTestOrders:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});