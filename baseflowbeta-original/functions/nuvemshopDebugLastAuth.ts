import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  // FASE 1 - PROVA DE DEPLOY (PRIMEIRA LINHA)
  const PATH = new URL(req.url).pathname;
  console.log(`[PROOF] CODE_VERSION=FIX_CLONE_429_2026_01_14 PATH=${PATH} TS=${new Date().toISOString()}`);

  // ENDPOINT DE HEALTH
  if (req.headers.get('x-proof') === '1') {
    return Response.json({ ok: true, code_version: "FIX_CLONE_429_2026_01_14", path: PATH, ts: new Date().toISOString() });
  }

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

    console.log('[DEBUG_LAST_AUTH] Checking last auth for store:', store_id);

    // Buscar integração ESPECÍFICA desta loja
    const integrations = await base44.asServiceRole.entities.Integration.filter({
      store_id: store_id,
      integration_type: 'NUVEMSHOP'
    });

    if (integrations.length === 0) {
      return Response.json({
        success: false,
        store_id,
        message: 'Nenhuma integração Nuvemshop encontrada para esta loja'
      });
    }

    const integration = integrations[0];
    const token = integration.api_key;

    console.log('[DEBUG_LAST_AUTH] Integration found:', {
      integration_id: integration.id,
      store_id: integration.store_id,
      status: integration.status,
      has_token: !!token,
      token_length: token?.length,
      created_date: integration.created_date,
      updated_date: integration.updated_date
    });

    // Informações sobre o último processo de auth
    const debugInfo = {
      store_id,
      nuvemshop_store_id: integration.store_url || 'N/A',
      integration_status: integration.status,
      token_info: {
        access_token_received: !!token,
        token_length: token?.length || 0,
        token_preview: token ? `${token.substring(0, 6)}...${token.substring(token.length - 6)}` : 'N/A',
        token_saved_at: integration.updated_date || integration.created_date
      },
      last_sync: integration.last_sync || 'Nunca',
      sync_status: integration.sync_status || 'N/A',
      sync_error: integration.sync_error_message || 'Nenhum',
      initial_sync_completed: integration.initial_sync_completed || false,
      created_at: integration.created_date,
      updated_at: integration.updated_date
    };

    // Se tiver token, testar se é válido
    if (token && integration.store_url) {
      try {
        console.log('[DEBUG_LAST_AUTH] Testing token validity...');
        const testResponse = await fetch(
          `https://api.nuvemshop.com.br/v1/${integration.store_url}/store`,
          {
            headers: {
              'Authorization': `bearer ${token}`,
              'User-Agent': 'Baseflow (contato@baseflow.com.br)'
            }
          }
        );

        debugInfo.token_validation = {
          http_status: testResponse.status,
          is_valid: testResponse.ok,
          status_text: testResponse.ok ? 'Token válido' : 'Token inválido'
        };

        if (!testResponse.ok) {
          const errorBody = await testResponse.text();
          debugInfo.token_validation.error_body = errorBody.substring(0, 300);
        }
      } catch (error) {
        debugInfo.token_validation = {
          error: 'Erro ao testar token: ' + error.message
        };
      }
    }

    return Response.json({
      success: true,
      ...debugInfo,
      message: token 
        ? '✅ Token encontrado no banco. Veja detalhes acima.'
        : '⚠️ Nenhum token salvo. Conecte a integração primeiro.'
    });

  } catch (error) {
    console.error('[DEBUG_LAST_AUTH] Error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});