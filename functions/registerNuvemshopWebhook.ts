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

  // Criar novo Request com body já lido para evitar erro de clone
  const newReq = new Request(req.url, {
    method: req.method,
    headers: req.headers,
    body: (req.method !== 'GET' && req.method !== 'HEAD' && bodyText) ? bodyText : undefined
  });
  const base44 = createClientFromRequest(newReq);

  try {
    const integration_id = body?.integration_id;

    if (!integration_id) {
      return Response.json({ error: 'integration_id is required' }, { status: 400 });
    }

    console.log(`[WEBHOOK_REGISTER] Starting webhook registration for integration ${integration_id}`);

    // Buscar integração
    const allIntegrations = await base44.asServiceRole.entities.Integration.list();
    const integration = allIntegrations.find(i => i.id === integration_id);

    if (!integration || integration.integration_type !== 'NUVEMSHOP') {
      return Response.json({ error: 'Integration not found' }, { status: 404 });
    }

    // Verificar se webhook já está registrado
    if (integration.webhook_registered) {
      console.log(`[WEBHOOK_REGISTER] Webhook already registered for store ${integration.store_id}`);
      return Response.json({ 
        success: true, 
        message: 'Webhook already registered',
        webhook_id: integration.webhook_id 
      });
    }

    const accessToken = integration.api_key;
    const nuvemshopStoreId = integration.nuvemshop_store_id || integration.store_url;

    if (!accessToken || !nuvemshopStoreId) {
      return Response.json({ error: 'Missing access token or store ID' }, { status: 400 });
    }

    console.log(`[WEBHOOK_REGISTER] Registering webhook for Nuvemshop store ${nuvemshopStoreId}`);

    // Eventos que queremos monitorar
    const webhookEvents = ['order/created', 'order/paid', 'order/updated'];
    const webhookUrl = 'https://www.baseflow.com.br/api/functions/nuvemshopWebhook';

    // Criar webhook na Nuvemshop
    const createWebhookResponse = await fetch(
      `https://api.nuvemshop.com.br/v1/${nuvemshopStoreId}/webhooks`,
      {
        method: 'POST',
        headers: {
          'Authentication': `bearer ${accessToken}`,
          'User-Agent': 'Baseflow (contato@baseflow.com.br)',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          url: webhookUrl,
          event: 'order/created'  // Nuvemshop requer um evento por webhook, vamos criar para order/created
        })
      }
    );

    if (!createWebhookResponse.ok) {
      const errorText = await createWebhookResponse.text();
      console.error(`[WEBHOOK_REGISTER] Failed to create webhook: ${createWebhookResponse.status}`, errorText);
      
      // Se webhook já existe (409), considerar como sucesso
      if (createWebhookResponse.status === 409) {
        console.log(`[WEBHOOK_REGISTER] Webhook already exists (409), marking as registered`);
        
        await base44.asServiceRole.entities.Integration.update(integration.id, {
          webhook_registered: true,
          webhook_url: webhookUrl,
          webhook_events: webhookEvents,
          webhook_created_at: new Date().toISOString()
        });

        return Response.json({ 
          success: true, 
          message: 'Webhook already exists',
          webhook_url: webhookUrl 
        });
      }

      return Response.json({ 
        error: `Failed to create webhook: ${createWebhookResponse.status}`,
        details: errorText 
      }, { status: createWebhookResponse.status });
    }

    const webhookData = await createWebhookResponse.json();
    console.log(`[WEBHOOK_REGISTER] Webhook created successfully:`, webhookData);

    // Criar webhooks adicionais para outros eventos
    const additionalEvents = ['order/paid', 'order/updated'];
    const webhookIds = [webhookData.id];

    for (const event of additionalEvents) {
      try {
        const additionalResponse = await fetch(
          `https://api.nuvemshop.com.br/v1/${nuvemshopStoreId}/webhooks`,
          {
            method: 'POST',
            headers: {
              'Authentication': `bearer ${accessToken}`,
              'User-Agent': 'Baseflow (contato@baseflow.com.br)',
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              url: webhookUrl,
              event: event
            })
          }
        );

        if (additionalResponse.ok) {
          const additionalData = await additionalResponse.json();
          webhookIds.push(additionalData.id);
          console.log(`[WEBHOOK_REGISTER] Additional webhook created for ${event}:`, additionalData.id);
        } else if (additionalResponse.status !== 409) {
          console.warn(`[WEBHOOK_REGISTER] Failed to create webhook for ${event}: ${additionalResponse.status}`);
        }
      } catch (error) {
        console.warn(`[WEBHOOK_REGISTER] Error creating webhook for ${event}:`, error);
      }
    }

    // Salvar no banco
    await base44.asServiceRole.entities.Integration.update(integration.id, {
      webhook_registered: true,
      webhook_id: webhookIds.join(','),
      webhook_url: webhookUrl,
      webhook_events: webhookEvents,
      webhook_created_at: new Date().toISOString()
    });

    console.log(`[WEBHOOK_REGISTER] Webhook registered successfully for store ${integration.store_id}`);

    return Response.json({ 
      success: true, 
      message: 'Webhook registered successfully',
      webhook_ids: webhookIds,
      webhook_url: webhookUrl,
      events: webhookEvents
    });

  } catch (error) {
    console.error('[WEBHOOK_REGISTER] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});