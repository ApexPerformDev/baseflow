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
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const store_id = body?.store_id;

    if (!store_id) {
      return Response.json({ error: 'store_id is required' }, { status: 400 });
    }

    console.log(`[RECALCULATE] Starting metrics recalculation for store ${store_id}`);

    // Executar RFM e ABC em paralelo
    const [rfmResult, abcResult] = await Promise.allSettled([
      base44.asServiceRole.functions.invoke('calculateRFM', { 
        store_id: store_id,
        period_days: 365 
      }),
      base44.asServiceRole.functions.invoke('calculateABC', { 
        store_id: store_id,
        period_days: 365 
      })
    ]);

    console.log('[RECALCULATE] RFM result:', rfmResult);
    console.log('[RECALCULATE] ABC result:', abcResult);

    const response = {
      success: true,
      rfm: rfmResult.status === 'fulfilled' ? rfmResult.value.data : { error: rfmResult.reason },
      abc: abcResult.status === 'fulfilled' ? abcResult.value.data : { error: abcResult.reason }
    };

    return Response.json(response);

  } catch (error) {
    console.error('[RECALCULATE] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});