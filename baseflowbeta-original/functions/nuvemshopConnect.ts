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

    // Verificar se a loja existe e se o usuário tem permissão
    const storeUsers = await base44.asServiceRole.entities.StoreUser.filter({
      store_id,
      user_email: user.email
    });

    if (storeUsers.length === 0) {
      return Response.json({ error: 'Access denied to this store' }, { status: 403 });
    }

    // Verificar se a loja tem assinatura ativa
    const stores = await base44.asServiceRole.entities.Store.list();
    const store = stores.find(s => s.id === store_id);
    
    if (!store || store.subscription_status !== 'ACTIVE') {
      return Response.json({ 
        error: 'Active subscription required',
        subscription_status: store?.subscription_status 
      }, { status: 403 });
    }

    // Gerar state token para segurança (anti-CSRF)
    const state = crypto.randomUUID();
    
    console.log('[CONNECT] Generated state:', state);
    console.log('[CONNECT] Store ID:', store_id);
    
    // Salvar state no campo oauth_state
    const existingIntegrations = await base44.asServiceRole.entities.Integration.filter({
      store_id,
      integration_type: 'NUVEMSHOP'
    });

    if (existingIntegrations.length > 0) {
      console.log('[CONNECT] Updating existing integration:', existingIntegrations[0].id);
      await base44.asServiceRole.entities.Integration.update(existingIntegrations[0].id, {
        oauth_state: state,
        status: 'connecting'
      });
    } else {
      console.log('[CONNECT] Creating new integration');
      await base44.asServiceRole.entities.Integration.create({
        store_id,
        integration_type: 'NUVEMSHOP',
        oauth_state: state,
        status: 'connecting'
      });
    }
    
    console.log('[CONNECT] State saved successfully');

    const APP_ID = Deno.env.get('NUVEMSHOP_APP_ID');
    
    // URL oficial do domínio customizado
    const REDIRECT_URI = 'https://www.baseflow.com.br/api/functions/nuvemshopCallback';
    
    // Construir URL de autorização OAuth completa
    const authUrl = `https://www.nuvemshop.com.br/apps/${APP_ID}/authorize?state=${state}`;

    console.log('[CONNECT] Generated auth URL:', authUrl);
    console.log('[CONNECT] APP_ID:', APP_ID);
    console.log('[CONNECT] REDIRECT_URI:', REDIRECT_URI);

    return Response.json({ 
      success: true,
      authUrl,
      state,
      redirect_uri: REDIRECT_URI
    });

  } catch (error) {
    console.error('Error in nuvemshopConnect:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});