import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { getNuvemshopHeaders, fetchWithRetry } from './nuvemshopApi.js';
import { base44CallWithRetry, sleep } from './_rateLimit.js';

const CODE_VERSION = "FIX_CLONE_429_2026_01_14";
const PER_PAGE = 50;
const MAX_PAGES_PER_RUN = 1;
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

    // 1) BUSCAR INTEGRATION (1 CALL)
    const integrations = await base44CallWithRetry(() =>
      base44.asServiceRole.entities.Integration.filter({ id: integration_id })
    );
    const integration = integrations?.[0];

    if (!integration || integration.integration_type !== 'NUVEMSHOP') {
      return Response.json({ error: 'Integration not found' }, { status: 404 });
    }

    const accessToken = integration.api_key;
    const nuvemshopStoreId = integration.nuvemshop_store_id;

    if (!accessToken || accessToken.length < 20) {
      await base44CallWithRetry(() =>
        base44.asServiceRole.entities.Integration.update(integration.id, {
          status: 'error',
          sync_status: 'error',
          sync_error_message: 'Token inválido ou ausente'
        })
      );
      return Response.json({ error: 'Token inválido' }, { status: 400 });
    }

    if (!nuvemshopStoreId) {
      await base44CallWithRetry(() =>
        base44.asServiceRole.entities.Integration.update(integration.id, {
          status: 'error',
          sync_status: 'error',
          sync_error_message: 'ID da loja Nuvemshop não encontrado'
        })
      );
      return Response.json({ error: 'ID da loja não encontrado' }, { status: 400 });
    }

    // FASE 3 - LOCK ATÔMICO + THROTTLE
    const now = Date.now();
    const nextAllowedAt = integration.sync_next_allowed_at ? new Date(integration.sync_next_allowed_at).getTime() : 0;
    
    if (now < nextAllowedAt) {
      const waitMs = nextAllowedAt - now;
      console.log(`[SYNC] THROTTLED: wait ${waitMs}ms before next run`);
      return Response.json({ throttled: true, wait_ms: waitMs });
    }

    const syncRunId = integration.sync_run_id || crypto.randomUUID();

    // LOCK: Se já está rodando, não iniciar outra
    if (integration.sync_status === 'running' && integration.sync_run_id && !integration.sync_cancel_requested) {
      console.log(`[SYNC] LOCK: already running run_id=${integration.sync_run_id}`);
      return Response.json({ already_running: true, sync_run_id: integration.sync_run_id });
    }

    const isNew = !integration.sync_cursor_page || integration.sync_cursor_page < 1;
    let currentPage = isNew ? 1 : integration.sync_cursor_page;

    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);
    const createdAtMin = oneYearAgo.toISOString().split('T')[0];

    // 2) SET RUNNING (1 UPDATE)
    await base44CallWithRetry(() =>
      base44.asServiceRole.entities.Integration.update(integration.id, {
        status: 'syncing',
        sync_status: 'running',
        sync_run_id: syncRunId,
        sync_phase: 1,
        sync_started_at: integration.sync_started_at || new Date().toISOString(),
        sync_error_message: null,
        sync_cancel_requested: false,
        sync_stage: `Coletando pedidos (1/2) | Página ${currentPage}...`,
        sync_cursor_page: currentPage
      })
    );

    // 3) VALIDAR TOKEN NUVEMSHOP (SEM BASE44)
    const headers = getNuvemshopHeaders(accessToken);
    const validateResponse = await fetchWithRetry(
      `https://api.nuvemshop.com.br/v1/${nuvemshopStoreId}/store`,
      { headers, method: 'GET' }
    );
    
    if (validateResponse.status === 401 || validateResponse.status === 403) {
      await base44CallWithRetry(() =>
        base44.asServiceRole.entities.Integration.update(integration.id, {
          status: 'error',
          sync_status: 'error',
          sync_error_message: 'Token inválido ou expirado',
          sync_run_id: null
        })
      );
      return Response.json({ error: 'Token inválido' }, { status: validateResponse.status });
    }
    
    if (!validateResponse.ok) {
      return Response.json({ error: `Erro ao validar token: ${validateResponse.status}` }, { status: 400 });
    }

    // 4) FASE 4 - PROCESSAR 1 PÁGINA
    let pagesDone = 0;
    let hasMore = true;

    while (hasMore && pagesDone < MAX_PAGES_PER_RUN) {
      // CANCELAMENTO (1 FILTER)
      const fresh = await base44CallWithRetry(() =>
        base44.asServiceRole.entities.Integration.filter({ id: integration.id })
      );
      const cur = fresh?.[0];
      
      if (cur?.sync_cancel_requested || cur?.sync_run_id !== syncRunId) {
        console.log(`[SYNC] CANCELLED run_id=${syncRunId}`);
        await base44CallWithRetry(() =>
          base44.asServiceRole.entities.Integration.update(integration.id, {
            status: 'connected',
            sync_status: 'idle',
            sync_stage: 'Cancelado',
            sync_progress_percent: 0,
            sync_run_id: null,
            sync_cancel_requested: false
          })
        );
        return Response.json({ success: false, cancelled: true });
      }

      console.log(`[SYNC] Fetching Nuvemshop page=${currentPage} created_at_min=${createdAtMin}`);

      const url = `https://api.nuvemshop.com.br/v1/${nuvemshopStoreId}/orders?created_at_min=${createdAtMin}&per_page=${PER_PAGE}&sort=created_at_asc&page=${currentPage}`;
      const ordersResponse = await fetchWithRetry(url, { headers, method: 'GET' }, { maxRetries: 10 });

      if (!ordersResponse.ok) {
        if (ordersResponse.status === 404) {
          const txt = await ordersResponse.text();
          if (txt.includes('Last page') || txt.includes('Not Found')) {
            console.log('[SYNC] End pagination by 404');
            hasMore = false;
            break;
          }
        }
        throw new Error(`Nuvemshop HTTP ${ordersResponse.status}`);
      }

      const orders = await ordersResponse.json();
      console.log(`[SYNC] Received ${orders.length} orders from page ${currentPage}`);

      if (!orders.length) {
        hasMore = false;
        break;
      }

      // 5) SALVAR PÁGINA (1 WRITE) - external_id único
      const external_id = `${integration.id}:${createdAtMin}:${currentPage}`;
      const rawPagePayload = {
        store_id: integration.store_id,
        integration_id: integration.id,
        external_id,
        page: currentPage,
        created_at_min: createdAtMin,
        payload_json: JSON.stringify(orders),
        processed: false
      };

      try {
        await base44CallWithRetry(() =>
          base44.asServiceRole.entities.NuvemshopOrdersRawPage.create(rawPagePayload)
        );
      } catch (e) {
        // Se duplicar, buscar e atualizar
        const found = await base44CallWithRetry(() =>
          base44.asServiceRole.entities.NuvemshopOrdersRawPage.filter({ integration_id: integration.id, external_id })
        );
        if (found?.[0]?.id) {
          await base44CallWithRetry(() =>
            base44.asServiceRole.entities.NuvemshopOrdersRawPage.update(found[0].id, rawPagePayload)
          );
        } else {
          throw e;
        }
      }

      currentPage++;
      pagesDone++;
    }

    // 6) UPDATE FINAL (1 UPDATE) + SET NEXT_ALLOWED_AT
    const nextAllowedAtDate = new Date(Date.now() + REINVOKE_DELAY_MS);
    await base44CallWithRetry(() =>
      base44.asServiceRole.entities.Integration.update(integration.id, {
        sync_cursor_page: currentPage,
        sync_stage: hasMore ? `Coletando pedidos (1/2) | Próxima página: ${currentPage}` : `Coleta concluída (1/2)`,
        sync_progress_percent: hasMore ? Math.min(45, 10 + (currentPage * 2)) : 50,
        sync_next_allowed_at: nextAllowedAtDate.toISOString()
      })
    );

    // 7) REINVOCAR SE TEM MAIS (com delay)
    if (hasMore) {
      console.log(`[SYNC] Continuing: reinvoking in ${REINVOKE_DELAY_MS}ms next_page=${currentPage}`);
      await sleep(REINVOKE_DELAY_MS);
      await base44CallWithRetry(() =>
        base44.asServiceRole.functions.invoke('nuvemshopInitialSync', { integration_id })
      );
      return Response.json({ success: true, continuing: true, next_page: currentPage, run_id: syncRunId });
    }

    // 8) FASE 1 COMPLETA - NÃO CHAMA FASE 2
    await base44CallWithRetry(() =>
      base44.asServiceRole.entities.Integration.update(integration.id, {
        sync_phase: 1,
        sync_stage: 'Fase 1 concluída (coleta). Pronto para iniciar fase 2 manualmente.',
        sync_progress_percent: 50
      })
    );

    return Response.json({
      success: true,
      phase: 1,
      message: 'Fase 1 concluída: páginas capturadas. Inicie fase 2 manualmente.'
    });

  } catch (error) {
    console.error('[SYNC] FATAL ERROR:', error?.message || String(error));

    // NUNCA TOCAR NO REQ AQUI
    if (integrationIdForCatch) {
      try {
        await base44CallWithRetry(() =>
          base44.asServiceRole.entities.Integration.update(integrationIdForCatch, {
            status: 'connected',
            sync_status: 'error',
            sync_stage: 'Erro na sincronização',
            sync_error_message: error?.message || String(error),
            sync_finished_at: new Date().toISOString(),
            sync_run_id: null,
            sync_cancel_requested: false
          })
        );
      } catch (e) {
        console.error('[SYNC] Error updating integration on catch:', e?.message || String(e));
      }
    }

    return Response.json({ success: false, error: error?.message || String(error) }, { status: 500 });
  }
});