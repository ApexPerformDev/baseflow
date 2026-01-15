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

    const integration_id = body?.integration_id;

    if (!integration_id) {
      return Response.json({ error: 'integration_id is required' }, { status: 400 });
    }

    console.log(`[CANCEL_SYNC] Cancelling sync for integration ${integration_id}`);

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

    // Atualizar integração para cancelar
    await base44.asServiceRole.entities.Integration.update(integration.id, {
      sync_cancel_requested: true,
      sync_run_id: null,
      sync_status: 'idle',
      status: 'connected',
      sync_stage: 'Cancelado pelo usuário',
      sync_cancelled_at: new Date().toISOString()
    });

    console.log('[CANCEL_SYNC] Sync cancellation requested successfully');

    return Response.json({ 
      success: true,
      message: 'Sincronização será cancelada'
    });

  } catch (error) {
    console.error('[CANCEL_SYNC] Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});