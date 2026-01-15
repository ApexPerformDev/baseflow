import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { getNuvemshopHeaders, fetchWithRetry } from './nuvemshopApi.js';

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

    // Verificar permissão
    const storeUsers = await base44.asServiceRole.entities.StoreUser.filter({
      store_id,
      user_email: user.email
    });

    if (storeUsers.length === 0) {
      return Response.json({ error: 'Access denied to this store' }, { status: 403 });
    }

    // Buscar integração Nuvemshop
    const integrations = await base44.asServiceRole.entities.Integration.filter({
      store_id,
      integration_type: 'NUVEMSHOP'
    });

    if (integrations.length === 0) {
      return Response.json({
        success: false,
        status: 'not_connected',
        message: 'Integração Nuvemshop não encontrada para esta loja'
      });
    }

    const integration = integrations[0];
    const accessToken = integration.api_key;
    const nuvemshopStoreId = integration.nuvemshop_store_id;

    console.log('[TEST_AUTH] Testing integration:', {
      integration_id: integration.id,
      store_id,
      nuvemshop_store_id: nuvemshopStoreId,
      has_token: !!accessToken,
      token_length: accessToken?.length
    });

    // Validar token antes de tentar request
    if (!accessToken || accessToken.length < 20) {
      return Response.json({
        success: false,
        status: 'incomplete',
        message: 'Token inválido ou ausente',
        details: {
          has_token: !!accessToken,
          token_length: accessToken?.length || 0
        }
      });
    }

    if (!nuvemshopStoreId) {
      return Response.json({
        success: false,
        status: 'incomplete',
        message: 'ID da loja Nuvemshop não encontrado. Reconecte a integração.',
        details: {
          has_store_id: false
        }
      });
    }

    // Testar chamada à API da Nuvemshop usando /store endpoint
    console.log('[TEST_AUTH] Making test API call to /store endpoint...');
    const headers = getNuvemshopHeaders(accessToken);
    const testResponse = await fetchWithRetry(
      `https://api.nuvemshop.com.br/v1/${nuvemshopStoreId}/store`,
      { headers, method: 'GET' }
    );

    console.log('[TEST_AUTH] API Response status:', testResponse.status);

    if (testResponse.ok) {
      const storeData = await testResponse.json();
      return Response.json({
        success: true,
        status: 'connected',
        message: 'Token válido! Conexão com Nuvemshop funcionando corretamente.',
        details: {
          nuvemshop_store_id: nuvemshopStoreId,
          api_response_status: testResponse.status,
          store_name: storeData.name || null,
          store_url: storeData.url || null
        }
      });
    } else {
      const errorText = await testResponse.text();
      console.error('[TEST_AUTH] API Error:', errorText);
      
      let message = 'Erro ao conectar com Nuvemshop';
      let suggestion = '';
      
      if (testResponse.status === 401) {
        message = 'Token de acesso inválido ou expirado';
        suggestion = 'Reconecte a integração através do botão "Desconectar" e depois "Conectar Nuvemshop" novamente.';
      } else if (testResponse.status === 403) {
        message = 'Acesso negado pela Nuvemshop';
        suggestion = 'Verifique se o app tem as permissões necessárias na Nuvemshop.';
      } else if (testResponse.status === 404) {
        message = 'Loja não encontrada';
        suggestion = 'O ID da loja pode estar incorreto. Reconecte a integração.';
      } else if (testResponse.status === 429) {
        message = 'Limite de requisições excedido';
        suggestion = 'Aguarde alguns minutos antes de tentar novamente.';
      }
      
      return Response.json({
        success: false,
        status: 'error',
        message,
        suggestion,
        details: {
          http_status: testResponse.status,
          error_response: errorText.substring(0, 500)
        }
      }, { status: testResponse.status });
    }

  } catch (error) {
    console.error('[TEST_AUTH] Error:', error);
    return Response.json({ 
      success: false,
      status: 'error',
      message: error.message,
      error: error.toString()
    }, { status: 500 });
  }
});