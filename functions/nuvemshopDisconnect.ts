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

    // Buscar integração
    const integrations = await base44.asServiceRole.entities.Integration.filter({
      store_id,
      integration_type: 'NUVEMSHOP'
    });

    if (integrations.length === 0) {
      return Response.json({ error: 'Integration not found' }, { status: 404 });
    }

    const integration = integrations[0];
    
    console.log('[DISCONNECT] Resetting integration:', {
      integration_id: integration.id,
      store_id,
      current_status: integration.status
    });

    // RESET: Limpar estado de conexão e OAuth
    await base44.asServiceRole.entities.Integration.update(integration.id, {
      status: 'disconnected',
      sync_status: 'idle',
      oauth_state: null,
      api_key: null,
      nuvemshop_store_id: null,
      store_url: null,
      sync_error_message: null,
      sync_run_id: null,
      sync_cancel_requested: false,
      sync_progress_percent: 0,
      sync_stage: null
    });

    console.log('[DISCONNECT] ✅ Integration reset successfully');

    return Response.json({ 
      success: true,
      message: 'Nuvemshop desconectada com sucesso. Todos os dados de autenticação foram removidos.'
    });

  } catch (error) {
    console.error('Error in nuvemshopDisconnect:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});