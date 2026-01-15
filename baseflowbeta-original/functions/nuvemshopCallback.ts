import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  // FASE 1 - PROVA DE DEPLOY (PRIMEIRA LINHA)
  const PATH = new URL(req.url).pathname;
  console.log(`[PROOF] CODE_VERSION=FIX_CLONE_429_2026_01_14 PATH=${PATH} TS=${new Date().toISOString()}`);

  // ENDPOINT DE HEALTH
  if (req.headers.get('x-proof') === '1') {
    return Response.json({ ok: true, code_version: "FIX_CLONE_429_2026_01_14", path: PATH, ts: new Date().toISOString() });
  }

  try {
    // Para callbacks OAuth, não precisamos de autenticação inicial
    // O state será nossa validação
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    console.log('[CALLBACK] Received OAuth callback');
    console.log('  - code:', code ? 'present' : 'missing');
    console.log('  - state:', state ? 'present' : 'missing');
    console.log('  - full URL:', req.url);

    if (!code || !state) {
      console.log('[CALLBACK] ERROR: Missing code or state');
      return new Response(
        '<html><body><script>window.opener.postMessage({error: "Missing code or state"}, "*"); window.close();</script></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    const base44 = createClientFromRequest(req);

    // Buscar integração com este state
    console.log('[CALLBACK] Searching for integration with state:', state);
    const allIntegrations = await base44.asServiceRole.entities.Integration.list();
    console.log('[CALLBACK] Total integrations found:', allIntegrations.length);
    
    const connectingIntegrations = allIntegrations.filter(i => 
      i.integration_type === 'NUVEMSHOP' && i.status === 'connecting'
    );
    console.log('[CALLBACK] Connecting NUVEMSHOP integrations:', connectingIntegrations.length);
    
    const integration = allIntegrations.find(i => 
      i.integration_type === 'NUVEMSHOP' && 
      i.oauth_state === state &&
      i.status === 'connecting'
    );

    if (!integration) {
      console.log('[CALLBACK] ERROR: Integration not found for state:', state);
      console.log('[CALLBACK] Available connecting integrations:', connectingIntegrations.map(i => ({
        id: i.id,
        oauth_state: i.oauth_state,
        status: i.status
      })));
      
      return new Response(
        '<html><body><script>window.opener.postMessage({error: "Invalid state or expired session"}, "*"); window.close();</script></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }
    
    console.log('[CALLBACK] Integration found:', integration.id);

    // ========================================
    // A) INSTRUMENTAÇÃO DO TOKEN EXCHANGE
    // ========================================
    
    const APP_ID = Deno.env.get('NUVEMSHOP_APP_ID');
    const CLIENT_SECRET = Deno.env.get('NUVEMSHOP_CLIENT_SECRET');
    const TOKEN_EXCHANGE_URL = 'https://www.nuvemshop.com.br/apps/authorize/token';
    const REDIRECT_URI = 'https://www.baseflow.com.br/api/functions/nuvemshopCallback';

    const requestPayload = {
      client_id: APP_ID,
      client_secret: CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code'
    };

    console.log('');
    console.log('========================================');
    console.log('A) TOKEN EXCHANGE REQUEST');
    console.log('========================================');
    console.log('1) Token Exchange Request Details:');
    console.log('   - token_endpoint_url:', TOKEN_EXCHANGE_URL);
    console.log('   - method: POST');
    console.log('   - headers:', { 'Content-Type': 'application/json' });
    console.log('   - body (masked secrets):');
    console.log('     {');
    console.log(`       "client_id": "${APP_ID}",`);
    console.log(`       "client_secret": "${CLIENT_SECRET ? '[MASKED_' + CLIENT_SECRET.length + '_CHARS]' : 'NOT_SET'}",`);
    console.log(`       "code": "${code ? code.substring(0, 10) + '...' + code.substring(code.length - 10) : 'NOT_SET'}",`);
    console.log(`       "grant_type": "authorization_code"`);
    console.log('     }');
    console.log('   - redirect_uri used in auth:', REDIRECT_URI);
    console.log('   - integration_id:', integration.id);
    console.log('   - store_id (Baseflow):', integration.store_id);
    console.log('');

    const tokenResponse = await fetch(TOKEN_EXCHANGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestPayload)
    });

    const responseStatus = tokenResponse.status;
    
    let tokenData;
    let responseText;
    
    try {
      responseText = await tokenResponse.text();
      tokenData = JSON.parse(responseText);
    } catch (parseError) {
      console.log('========================================');
      console.log('2) Token Exchange Response:');
      console.log('========================================');
      console.log('   - http_status:', responseStatus);
      console.log('   - response_body: [UNPARSEABLE - NOT JSON]');
      console.log('   - raw_text:', responseText);
      console.log('   - access_token_received: false');
      console.log('   - ERROR: Response is not valid JSON');
      console.log('========================================');
      console.log('');
      
      await base44.asServiceRole.entities.Integration.update(integration.id, {
        status: 'error',
        sync_error_message: `Token exchange retornou resposta inválida (${responseStatus}): não é JSON válido`
      });
      
      return new Response(
        `<html><body><script>window.opener.postMessage({error: "Resposta inválida do token exchange - não é JSON"}, "*"); window.close();</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    console.log('========================================');
    console.log('2) Token Exchange Response:');
    console.log('========================================');
    console.log('   - http_status:', responseStatus);
    console.log('   - response_body (COMPLETE):');
    console.log(JSON.stringify(tokenData, null, 4));
    console.log('');

    if (!tokenResponse.ok) {
      console.log('   - access_token_received: false');
      console.log('   - ERROR:', tokenData.error || 'Unknown');
      console.log('   - ERROR_DESCRIPTION:', tokenData.error_description || tokenData.message || 'N/A');
      console.log('========================================');
      console.log('');
      console.log('❌ TOKEN EXCHANGE FAILED - NOT SAVING TO DATABASE');
      console.log('');
      
      const errorMessage = tokenData.error_description || tokenData.message || tokenData.error || 'Unknown error';
      
      await base44.asServiceRole.entities.Integration.update(integration.id, {
        status: 'error',
        sync_error_message: `Token exchange falhou (${responseStatus}): ${errorMessage}`
      });
      
      return new Response(
        `<html><body><script>window.opener.postMessage({error: "Token exchange falhou (${responseStatus}): ${errorMessage}"}, "*"); window.close();</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Extrair campos da resposta
    const { access_token, user_id, token_type, scope } = tokenData;

    console.log('   - access_token_received:', !!access_token);
    if (access_token) {
      console.log('   - access_token_length:', access_token.length);
      console.log('   - token_preview:', `${access_token.substring(0, 6)}...${access_token.substring(access_token.length - 6)}`);
    } else {
      console.log('   - token_preview: NOT_FOUND');
    }
    console.log('   - token_type:', token_type || 'N/A');
    console.log('   - scope:', scope || 'N/A');
    console.log('   - user_id:', user_id || 'NOT_FOUND');
    console.log('========================================');
    console.log('');

    // ========================================
    // B) VALIDAÇÃO E CORREÇÃO DO FLUXO
    // ========================================

    // 1) Garantir que recebemos access_token
    if (!access_token || !user_id) {
      console.log('❌ VALIDATION FAILED: Missing access_token or user_id');
      console.log('   - has_access_token:', !!access_token);
      console.log('   - has_user_id:', !!user_id);
      console.log('   - NOT SAVING TO DATABASE');
      console.log('');

      await base44.asServiceRole.entities.Integration.update(integration.id, {
        status: 'error',
        sync_error_message: 'Token exchange não retornou access_token ou user_id'
      });

      return new Response(
        '<html><body><script>window.opener.postMessage({error: "Token exchange incompleto - access_token ou user_id não encontrado"}, "*"); window.close();</script></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // 2) DESCOBERTA DO STORE_ID REAL
    console.log('========================================');
    console.log('3) Store ID Discovery');
    console.log('========================================');
    console.log('   - user_id from token exchange:', user_id);
    console.log('   - Calling /v1/{user_id}/store to discover real store_id...');

    const discoveryUrl = `https://api.nuvemshop.com.br/v1/${user_id}/store`;
    const discoveryResponse = await fetch(discoveryUrl, {
      headers: {
        'Authentication': `bearer ${access_token}`,
        'User-Agent': 'Baseflow (contato@baseflow.com.br)',
        'Accept': 'application/json'
      }
    });

    console.log('   - Discovery response status:', discoveryResponse.status);

    if (!discoveryResponse.ok) {
      const errorBody = await discoveryResponse.text();
      console.log('   - Discovery response body:', errorBody);
      console.log('========================================');
      console.log('');
      console.log('❌ STORE DISCOVERY FAILED - Status:', discoveryResponse.status);
      console.log('   Cannot determine real store_id');
      console.log('');

      await base44.asServiceRole.entities.Integration.update(integration.id, {
        status: 'error',
        sync_error_message: `Erro ao descobrir store_id (${discoveryResponse.status}). Token pode ser inválido.`
      });

      return new Response(
        `<html><body><script>window.opener.postMessage({error: "Erro ao descobrir store_id (${discoveryResponse.status})"}, "*"); window.close();</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    const storeData = await discoveryResponse.json();
    const realStoreId = storeData.id ? storeData.id.toString() : user_id.toString();

    console.log('   - Discovery response body:', JSON.stringify(storeData, null, 4));
    console.log('   - Store name:', storeData.name || 'N/A');
    console.log('   - Store URL:', storeData.url || 'N/A');
    console.log('   - REAL store_id:', realStoreId);
    console.log('========================================');
    console.log('');

    // 3) VALIDAÇÃO DO TOKEN COM STORE_ID REAL
    console.log('========================================');
    console.log('4) Token Validation with Real Store ID');
    console.log('========================================');
    const testUrl = `https://api.nuvemshop.com.br/v1/${realStoreId}/store`;

    console.log('   - Test endpoint:', testUrl);
    console.log('   - Method: GET');
    console.log('   - Token preview:', `${access_token.substring(0, 6)}...${access_token.substring(access_token.length - 6)}`);
    console.log('');
    console.log('   Sending validation request...');

    const testResponse = await fetch(testUrl, {
      headers: {
        'Authentication': `bearer ${access_token}`,
        'User-Agent': 'Baseflow (contato@baseflow.com.br)',
        'Accept': 'application/json'
      }
    });

    console.log('   - Validation response status:', testResponse.status);

    if (!testResponse.ok) {
      const errorBody = await testResponse.text();
      console.log('   - Validation response body:', errorBody);
      console.log('========================================');
      console.log('');
      console.log('❌ TOKEN VALIDATION FAILED - Status:', testResponse.status);
      console.log('   This means the access_token received from exchange is INVALID');
      console.log('   NOT SAVING TO DATABASE - NOT MARKING AS CONNECTED');
      console.log('');

      await base44.asServiceRole.entities.Integration.update(integration.id, {
        status: 'error',
        sync_error_message: `Token inválido (validação retornou ${testResponse.status}). Verifique credenciais do app na Nuvemshop.`
      });

      return new Response(
        `<html><body><script>window.opener.postMessage({error: "Token inválido (${testResponse.status}). Verifique configuração do app."}, "*"); window.close();</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    const testData = await testResponse.json();
    console.log('   - Validation response body:', JSON.stringify(testData, null, 4));
    console.log('   - Store name:', testData.name || 'N/A');
    console.log('   - Store URL:', testData.url || 'N/A');
    console.log('========================================');
    console.log('');
    console.log('✅ TOKEN VALIDATION SUCCESS - Token is valid!');

    // 5) Salvar no banco apenas após validação bem-sucedida
    console.log('========================================');
    console.log('5) Saving to Database');
    console.log('========================================');
    console.log('   Fields being saved:');
    console.log('   - api_key (contains exact access_token from exchange)');
    console.log('     * Length:', access_token.length);
    console.log('     * Preview:', `${access_token.substring(0, 6)}...${access_token.substring(access_token.length - 6)}`);
    console.log('   - nuvemshop_store_id (REAL store_id):', realStoreId);
    console.log('   - store_url:', realStoreId);
    console.log('   - status: connected (only after validation success)');
    console.log('   - sync_status: idle');
    console.log('   - initial_sync_completed: false');
    console.log('');
    console.log('   Filter: store_id =', integration.store_id, '+ integration_type = NUVEMSHOP');

    const updateData = {
      api_key: access_token,
      store_url: realStoreId,
      nuvemshop_store_id: realStoreId,
      status: 'connected',
      sync_status: 'idle',
      initial_sync_completed: false,
      sync_error_message: null,
      last_sync: new Date().toISOString()
    };

    await base44.asServiceRole.entities.Integration.update(integration.id, updateData);

    console.log('   ✅ Database updated successfully');
    console.log('========================================');

    console.log('');
    console.log('========================================');
    console.log('✅ INTEGRATION CONFIGURED SUCCESSFULLY');
    console.log('========================================');
    console.log('Summary:');
    console.log('  - Integration ID:', integration.id);
    console.log('  - Store ID (Baseflow):', integration.store_id);
    console.log('  - user_id from token:', user_id);
    console.log('  - REAL Nuvemshop Store ID:', realStoreId);
    console.log('  - Status: connected');
    console.log('  - Token validated: YES');
    console.log('  - Ready for sync: YES');
    console.log('========================================');
    console.log('');

    // 6) Disparar initial sync automaticamente em background
    console.log('========================================');
    console.log('6) Auto-triggering Initial Sync (365 days)');
    console.log('========================================');
    console.log('   Starting background sync...');
    
    // Não esperar a resposta - iniciar em background usando a função base44
    base44.asServiceRole.functions.invoke('nuvemshopInitialSync', {
      integration_id: integration.id
    }).catch(err => {
      console.error('Error triggering initial sync:', err);
    });
    
    console.log('   ✅ Initial sync started in background');
    console.log('');

    // 7) Registrar webhook automaticamente (1x por loja)
    console.log('========================================');
    console.log('7) Auto-registering Webhook');
    console.log('========================================');
    console.log('   Registering webhook for real-time updates...');
    
    base44.asServiceRole.functions.invoke('registerNuvemshopWebhook', {
      integration_id: integration.id
    }).catch(err => {
      console.error('Error registering webhook:', err);
    });
    
    console.log('   ✅ Webhook registration started');
    console.log('');

    // Redirecionar para a página de configurações com sucesso
    const redirectUrl = 'https://www.baseflow.com.br/#/Settings?tab=integrations&provider=nuvemshop&status=success';
    
    return new Response(
      `<html><body><script>
        if (window.opener) {
          window.opener.postMessage({success: true, message: "Nuvemshop conectada com sucesso!"}, "*");
          window.close();
        } else {
          window.location.href = "${redirectUrl}";
        }
      </script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );

  } catch (error) {
    console.error('Error in nuvemshopCallback:', error);
    return new Response(
      `<html><body><script>window.opener.postMessage({error: "${error.message}"}, "*"); window.close();</script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
});