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

    console.log('[DEBUG_AUTH] Starting debug for store:', store_id);

    // Buscar integração ESPECÍFICA desta loja
    const integrations = await base44.asServiceRole.entities.Integration.filter({
      store_id: store_id,
      integration_type: 'NUVEMSHOP'
    });

    console.log('[DEBUG_AUTH] Integrations found:', integrations.length);

    if (integrations.length === 0) {
      return Response.json({
        success: false,
        store_id,
        integration_found: false,
        message: 'Nenhuma integração Nuvemshop encontrada para esta loja'
      });
    }

    const integration = integrations[0];
    const token = integration.api_key;
    const nuvemshopStoreId = integration.store_url;

    console.log('[DEBUG_AUTH] Integration details:', {
      integration_id: integration.id,
      store_id: integration.store_id,
      nuvemshop_store_id: nuvemshopStoreId,
      status: integration.status,
      has_token: !!token,
      token_length: token?.length,
      created_date: integration.created_date,
      updated_date: integration.updated_date,
      last_sync: integration.last_sync
    });

    // Informações do token (sem expor o token completo)
    const tokenInfo = {
      token_exists: !!token,
      token_length: token?.length || 0,
      token_preview: token ? `${token.substring(0, 6)}...${token.substring(token.length - 6)}` : 'N/A',
      token_saved_at: integration.updated_date || integration.created_date
    };

    if (!token || !nuvemshopStoreId) {
      return Response.json({
        success: false,
        store_id,
        nuvemshop_store_id: nuvemshopStoreId,
        integration_found: true,
        ...tokenInfo,
        message: 'Token ou Store ID não configurado. Reconecte a integração.',
        details: {
          has_token: !!token,
          has_store_id: !!nuvemshopStoreId
        }
      });
    }

    // Testar token com a API da Nuvemshop
    console.log('[DEBUG_AUTH] Testing token with Nuvemshop API...');
    console.log('[DEBUG_AUTH] Using store ID:', nuvemshopStoreId);
    console.log('[DEBUG_AUTH] Token preview:', tokenInfo.token_preview);

    const apiUrl = `https://api.nuvemshop.com.br/v1/${nuvemshopStoreId}/store`;
    console.log('[DEBUG_AUTH] API URL:', apiUrl);

    const apiResponse = await fetch(apiUrl, {
      headers: {
        'Authentication': `bearer ${token}`,
        'User-Agent': 'Baseflow (contato@baseflow.com.br)',
        'Accept': 'application/json'
      }
    });

    console.log('[DEBUG_AUTH] API Response status:', apiResponse.status);

    const responseBody = await apiResponse.text();
    console.log('[DEBUG_AUTH] API Response body preview:', responseBody.substring(0, 500));

    if (apiResponse.ok) {
      const storeData = JSON.parse(responseBody);
      return Response.json({
        success: true,
        store_id,
        nuvemshop_store_id: nuvemshopStoreId,
        integration_found: true,
        ...tokenInfo,
        api_test: {
          http_status: apiResponse.status,
          status_text: 'OK - Token válido',
          store_name: storeData.name || 'N/A',
          store_url: storeData.url || 'N/A',
          store_email: storeData.email || 'N/A'
        },
        message: '✅ Token válido! Autenticação funcionando corretamente.'
      });
    } else {
      let errorMessage = 'Token inválido ou erro na API';
      let suggestion = '';

      if (apiResponse.status === 401) {
        errorMessage = '❌ Token inválido ou expirado';
        suggestion = 'Reconecte a integração: Desconectar → Conectar Nuvemshop novamente';
      } else if (apiResponse.status === 403) {
        errorMessage = 'Acesso negado (403)';
        suggestion = 'Verifique as permissões do app na Nuvemshop';
      } else if (apiResponse.status === 404) {
        errorMessage = 'Loja não encontrada (404)';
        suggestion = 'Verifique se o Store ID está correto';
      }

      return Response.json({
        success: false,
        store_id,
        nuvemshop_store_id: nuvemshopStoreId,
        integration_found: true,
        ...tokenInfo,
        api_test: {
          http_status: apiResponse.status,
          status_text: errorMessage,
          error_body: responseBody.substring(0, 500)
        },
        message: errorMessage,
        suggestion
      });
    }

  } catch (error) {
    console.error('[DEBUG_AUTH] Error:', error);
    return Response.json({ 
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});