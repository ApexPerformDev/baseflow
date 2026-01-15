import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
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
    const email = body?.email;
    const role = body?.role;

    if (!store_id || !email || !role) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verificar se o usuário atual é admin da loja
    const storeUsers = await base44.asServiceRole.entities.StoreUser.filter({
      store_id,
      user_email: user.email
    });

    const currentUserRole = storeUsers.find(su => su.user_email === user.email);
    if (!currentUserRole || currentUserRole.role !== 'admin') {
      return Response.json({ error: 'Only admins can invite users' }, { status: 403 });
    }

    // Verificar se o usuário já está vinculado à loja
    const existingUser = await base44.asServiceRole.entities.StoreUser.filter({
      store_id,
      user_email: email
    });

    if (existingUser.length > 0) {
      return Response.json({ error: 'User already invited to this store' }, { status: 400 });
    }

    // Criar vínculo do usuário
    const storeUser = await base44.asServiceRole.entities.StoreUser.create({
      store_id,
      user_email: email,
      role,
      invited_by: user.email,
      accepted_at: new Date().toISOString()
    });

    // Enviar email de convite
    try {
      const stores = await base44.asServiceRole.entities.Store.list();
      const store = stores.find(s => s.id === store_id);
      
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: `Convite para ${store?.name || 'loja'} - RFM Analytics`,
        body: `
          <h2>Você foi convidado para uma loja!</h2>
          <p>Olá!</p>
          <p>${user.email} convidou você para fazer parte da loja <strong>${store?.name || 'sem nome'}</strong> no RFM Analytics.</p>
          <p>Seu papel: <strong>${role === 'admin' ? 'Administrador' : 'Usuário Básico'}</strong></p>
          <p>Acesse a plataforma para começar: <a href="${Deno.env.get('APP_URL') || 'https://app.base44.com'}">Acessar RFM Analytics</a></p>
          <br>
          <p>Atenciosamente,<br>Equipe RFM Analytics</p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
    }

    return Response.json({ 
      success: true, 
      storeUser 
    });

  } catch (error) {
    console.error('Error inviting user:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});