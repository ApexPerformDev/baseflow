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
    const user_email = body?.user_email;
    const new_role = body?.new_role;

    if (!store_id || !user_email || !new_role) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['admin', 'basic'].includes(new_role)) {
      return Response.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Verificar se o usuário atual é admin
    const currentUserStoreUsers = await base44.asServiceRole.entities.StoreUser.filter({
      store_id,
      user_email: user.email
    });

    const currentUserRole = currentUserStoreUsers.find(su => su.user_email === user.email);
    if (!currentUserRole || currentUserRole.role !== 'admin') {
      return Response.json({ error: 'Only admins can update user roles' }, { status: 403 });
    }

    // Buscar o vínculo do usuário
    const storeUsers = await base44.asServiceRole.entities.StoreUser.filter({
      store_id,
      user_email
    });

    if (storeUsers.length === 0) {
      return Response.json({ error: 'User not found in store' }, { status: 404 });
    }

    // Atualizar papel
    const updated = await base44.asServiceRole.entities.StoreUser.update(
      storeUsers[0].id,
      { role: new_role }
    );

    return Response.json({ success: true, storeUser: updated });

  } catch (error) {
    console.error('Error updating user role:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});