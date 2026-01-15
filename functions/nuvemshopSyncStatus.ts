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

    // Buscar integração
    const allIntegrations = await base44.asServiceRole.entities.Integration.list();
    const integration = allIntegrations.find(i => i.id === integration_id);

    if (!integration) {
      return Response.json({ error: 'Integration not found' }, { status: 404 });
    }

    // Retornar status detalhado
    return Response.json({
      status: integration.status,
      sync_status: integration.sync_status || 'idle',
      sync_progress_percent: integration.sync_progress_percent || 0,
      sync_total_pages: integration.sync_total_pages || 0,
      sync_processed_pages: integration.sync_processed_pages || 0,
      sync_stage: integration.sync_stage || '',
      sync_started_at: integration.sync_started_at || null,
      sync_finished_at: integration.sync_finished_at || null,
      sync_error_message: integration.sync_error_message || null,
      initial_sync_completed: integration.initial_sync_completed || false,
      last_sync: integration.last_sync || null
    });

  } catch (error) {
    console.error('Error in nuvemshopSyncStatus:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});