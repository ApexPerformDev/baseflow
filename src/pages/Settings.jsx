import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Store, CreditCard, Users, Settings as SettingsIcon, Building2 } from 'lucide-react';
import IntegrationCard from '../components/settings/IntegrationCard';
import SubscriptionCard from '../components/settings/SubscriptionCard';
import UserManagement from '../components/settings/UserManagement';
import CompanyData from '../components/settings/CompanyData';

export default function Settings() {
  const [currentStore, setCurrentStore] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const storeData = localStorage.getItem('currentStore');
    if (!storeData) {
      window.location.href = '/';
      return;
    }
    setCurrentStore(JSON.parse(storeData));

    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {
      // Não fazer logout, apenas não carregar dados do usuário
    });
  }, []);

  const { data: storeDetails } = useQuery({
    queryKey: ['store', currentStore?.id],
    queryFn: async () => {
      if (!currentStore?.id) return null;
      const stores = await base44.entities.Store.list();
      return stores.find(s => s.id === currentStore.id);
    },
    enabled: !!currentStore?.id
  });

  const { data: integrations = [] } = useQuery({
    queryKey: ['integrations', currentStore?.id],
    queryFn: async () => {
      if (!currentStore?.id) return [];
      return await base44.entities.Integration.filter({ store_id: currentStore.id });
    },
    enabled: !!currentStore?.id
  });

  const { data: storeUsers = [] } = useQuery({
    queryKey: ['storeUsers', currentStore?.id],
    queryFn: async () => {
      if (!currentStore?.id) return [];
      return await base44.entities.StoreUser.filter({ store_id: currentStore.id });
    },
    enabled: !!currentStore?.id
  });

  const connectIntegrationMutation = useMutation({
    mutationFn: async ({ type, data }) => {
      return await base44.entities.Integration.create({
        store_id: currentStore.id,
        integration_type: type,
        status: 'connected',
        api_key: data.api_key,
        store_url: data.store_url,
        last_sync: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['integrations']);
    }
  });

  const disconnectIntegrationMutation = useMutation({
    mutationFn: async (integrationId) => {
      return await base44.entities.Integration.delete(integrationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['integrations']);
    }
  });

  const canConnect = storeDetails?.subscription_status === 'ACTIVE';

  const integrationsList = [
    {
      type: 'NUVEMSHOP',
      name: 'Nuvemshop',
      description: 'Conecte sua loja Nuvemshop para importar pedidos e clientes automaticamente',
      icon: Store
    },
    {
      type: 'BLING',
      name: 'Bling ERP',
      description: 'Integre com o Bling para sincronizar produtos, pedidos e estoque',
      icon: SettingsIcon
    }
  ];

  const handleConnect = async (type, data) => {
    await connectIntegrationMutation.mutateAsync({ type, data });
  };

  const handleDisconnect = async (integrationId) => {
    if (confirm('Tem certeza que deseja desconectar esta integração?')) {
      await disconnectIntegrationMutation.mutateAsync(integrationId);
    }
  };

  const handleSync = async (integrationId) => {
    try {
      console.log('[SYNC] Iniciando sincronização...');
      
      const response = await base44.functions.invoke('nuvemshopSync', { 
        store_id: currentStore.id 
      });
      
      console.log('[SYNC] Resposta da API:', response.data);
      
      const data = response.data;
      
      // Invalidar todas as queries para forçar reload
      await queryClient.invalidateQueries(['integrations']);
      await queryClient.invalidateQueries(['orders']);
      await queryClient.invalidateQueries(['customers']);
      await queryClient.invalidateQueries(['products']);
      await queryClient.invalidateQueries(['orderItems']);
      await queryClient.invalidateQueries(['rfmAnalysis']);
      await queryClient.invalidateQueries(['abcAnalysis']);
      
      if (data.success) {
        const details = `✅ Sincronização concluída!

📦 Dados importados nesta sincronização:
   • Pedidos processados: ${data.ordersImported || 0}

📊 Total de dados no banco:
   • Pedidos: ${data.totalOrdersInDB || 0}
   • Clientes: ${data.totalCustomersInDB || 0}
   • Produtos: ${data.totalProductsInDB || 0}
   • Itens de pedidos: ${data.itemsImported || 0}

🕒 Última sincronização: ${data.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString('pt-BR') : 'Agora'}`;
        
        alert(details);
      } else {
        const errorMsg = data.message || 'Erro desconhecido';
        let fullMessage = '❌ Erro na sincronização:\n\n' + errorMsg;
        
        if (errorMsg.includes('Token de acesso inválido') || errorMsg.includes('401')) {
          fullMessage += '\n\n💡 Solução: Clique em "Desconectar" e depois "Conectar Nuvemshop" novamente para renovar o token.';
        }
        
        alert(fullMessage);
      }
    } catch (error) {
      console.error('[SYNC] Erro:', error);
      alert('❌ Erro ao sincronizar: ' + error.message);
    } finally {
      await queryClient.invalidateQueries(['integrations']);
    }
  };

  const handleCheckStatus = async () => {
    try {
      const response = await base44.functions.invoke('nuvemshopStatus', { 
        store_id: currentStore.id 
      });
      
      console.log('[STATUS] Resposta:', response.data);
      
      const data = response.data;
      if (!data.connected) {
        alert('Nuvemshop não está conectada.');
        return;
      }
      
      const details = `
Status da Integração Nuvemshop

Store ID: ${data.storeId}
Nuvemshop Store ID: ${data.integration.nuvemshopStoreId}
Status: ${data.integration.status}
Última Sincronização: ${data.integration.lastSyncAt ? new Date(data.integration.lastSyncAt).toLocaleString('pt-BR') : 'Nunca'}

Dados no Banco:
- Pedidos: ${data.database.ordersCount}
- Clientes: ${data.database.customersCount}
- Produtos: ${data.database.productsCount}
- Itens: ${data.database.itemsCount}
- Análises RFM: ${data.database.rfmAnalysisCount}
- Análises ABC: ${data.database.abcAnalysisCount}

Estatísticas:
- Pedidos Pagos: ${data.statistics.paidOrdersCount}
- Receita Total: R$ ${data.statistics.totalRevenue}
- Último Pedido: ${data.statistics.lastOrderDate ? new Date(data.statistics.lastOrderDate).toLocaleString('pt-BR') : 'N/A'}
      `.trim();
      
      alert(details);
    } catch (error) {
      console.error('[STATUS] Erro:', error);
      alert('Erro ao verificar status: ' + error.message);
    }
  };

  const handleTestAuth = async () => {
    try {
      const response = await base44.functions.invoke('nuvemshopDebugAuth', { 
        store_id: currentStore.id 
      });
      
      console.log('[DEBUG_AUTH] Resposta:', response.data);
      
      const data = response.data;
      
      if (data.success) {
        let details = `${data.message}\n\n`;
        details += `📊 Informações da Integração:\n`;
        details += `- Store ID (Baseflow): ${data.store_id}\n`;
        details += `- Nuvemshop Store ID: ${data.nuvemshop_store_id}\n`;
        details += `- Token: ${data.token_preview}\n`;
        details += `- Token salvo em: ${new Date(data.token_saved_at).toLocaleString('pt-BR')}\n\n`;
        details += `🔌 Teste de API:\n`;
        details += `- Status HTTP: ${data.api_test.http_status}\n`;
        details += `- Loja: ${data.api_test.store_name}\n`;
        details += `- Email: ${data.api_test.store_email}`;
        alert(details);
      } else {
        let details = `${data.message}\n\n`;
        details += `📊 Informações:\n`;
        details += `- Store ID: ${data.store_id}\n`;
        details += `- Nuvemshop Store ID: ${data.nuvemshop_store_id || 'N/A'}\n`;
        details += `- Token existe: ${data.token_exists ? 'Sim' : 'Não'}\n`;
        if (data.token_preview && data.token_preview !== 'N/A') {
          details += `- Token: ${data.token_preview}\n`;
        }
        if (data.api_test) {
          details += `\n🔌 Teste de API:\n`;
          details += `- Status HTTP: ${data.api_test.http_status}\n`;
        }
        if (data.suggestion) {
          details += `\n💡 ${data.suggestion}`;
        }
        alert(details);
      }
    } catch (error) {
      console.error('[DEBUG_AUTH] Erro:', error);
      alert('❌ Erro ao testar: ' + error.message);
    }
  };

  const handleDebugCounts = async () => {
    try {
      const response = await base44.functions.invoke('nuvemshopDebugCounts', { 
        store_id: currentStore.id 
      });
      
      console.log('[DEBUG_COUNTS] Resposta:', response.data);
      
      const data = response.data;
      
      let details = `${data.message}\n\n`;
      details += `📊 Dados no Banco:\n`;
      details += `- Pedidos: ${data.counts.orders}\n`;
      details += `- Clientes: ${data.counts.customers}\n`;
      details += `- Produtos: ${data.counts.products}\n`;
      details += `- Itens de pedidos: ${data.counts.order_items}\n`;
      details += `- Análises RFM: ${data.counts.rfm_analysis}\n`;
      details += `- Análises ABC: ${data.counts.abc_analysis}\n\n`;
      details += `💰 Estatísticas:\n`;
      details += `- Pedidos pagos: ${data.statistics.paid_orders}\n`;
      details += `- Receita total: R$ ${data.statistics.total_revenue}\n`;
      details += `- Ticket médio: R$ ${data.statistics.avg_order_value}\n\n`;
      details += `🔄 Integração:\n`;
      details += `- Status: ${data.integration.status}\n`;
      details += `- Última sync: ${data.integration.last_sync ? new Date(data.integration.last_sync).toLocaleString('pt-BR') : 'Nunca'}\n`;
      
      if (data.latest_data.orders.length > 0) {
        details += `\n📦 Últimos pedidos:\n`;
        data.latest_data.orders.forEach(o => {
          details += `- #${o.id}: R$ ${o.amount} (${new Date(o.date).toLocaleDateString('pt-BR')})\n`;
        });
      }
      
      alert(details);
    } catch (error) {
      console.error('[DEBUG_COUNTS] Erro:', error);
      alert('❌ Erro ao buscar contagens: ' + error.message);
    }
  };

  const handleDebugLastAuth = async () => {
    try {
      const response = await base44.functions.invoke('nuvemshopDebugLastAuth', { 
        store_id: currentStore.id 
      });
      
      console.log('[DEBUG_LAST_AUTH] Resposta:', response.data);
      
      const data = response.data;
      
      let details = `${data.message}\n\n`;
      details += `📊 Informações da Última Autenticação:\n`;
      details += `- Store ID (Baseflow): ${data.store_id}\n`;
      details += `- Nuvemshop Store ID: ${data.nuvemshop_store_id}\n`;
      details += `- Status: ${data.integration_status}\n\n`;
      details += `🔑 Token Info:\n`;
      details += `- Token recebido: ${data.token_info.access_token_received ? 'Sim' : 'Não'}\n`;
      details += `- Tamanho: ${data.token_info.token_length} chars\n`;
      details += `- Preview: ${data.token_info.token_preview}\n`;
      details += `- Salvo em: ${new Date(data.token_info.token_saved_at).toLocaleString('pt-BR')}\n\n`;
      
      if (data.token_validation) {
        details += `✅ Validação do Token:\n`;
        details += `- Status HTTP: ${data.token_validation.http_status}\n`;
        details += `- Válido: ${data.token_validation.is_valid ? 'Sim ✅' : 'Não ❌'}\n`;
        details += `- Resultado: ${data.token_validation.status_text}\n`;
        if (data.token_validation.error_body) {
          details += `- Erro: ${data.token_validation.error_body.substring(0, 100)}...\n`;
        }
      }
      
      details += `\n🔄 Sincronização:\n`;
      details += `- Última sync: ${data.last_sync}\n`;
      details += `- Status sync: ${data.sync_status}\n`;
      if (data.sync_error !== 'Nenhum') {
        details += `- Erro: ${data.sync_error}\n`;
      }
      
      alert(details);
    } catch (error) {
      console.error('[DEBUG_LAST_AUTH] Erro:', error);
      alert('❌ Erro ao buscar info de auth: ' + error.message);
    }
  };

  const handleSubscribe = () => {
    // In production, would redirect to Stripe
    console.log('Redirecting to Stripe checkout...');
  };

  const inviteUserMutation = useMutation({
    mutationFn: async ({ email, role }) => {
      const response = await base44.functions.invoke('inviteUser', {
        store_id: currentStore.id,
        email,
        role
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['storeUsers']);
    }
  });

  const removeUserMutation = useMutation({
    mutationFn: async (user_email) => {
      const response = await base44.functions.invoke('removeUserFromStore', {
        store_id: currentStore.id,
        user_email
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['storeUsers']);
    }
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ user_email, new_role }) => {
      const response = await base44.functions.invoke('updateUserRole', {
        store_id: currentStore.id,
        user_email,
        new_role
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['storeUsers']);
    }
  });

  const handleInviteUser = async (email, role) => {
    await inviteUserMutation.mutateAsync({ email, role });
  };

  const handleRemoveUser = async (user_email) => {
    await removeUserMutation.mutateAsync(user_email);
  };

  const handleUpdateUserRole = async (user_email, new_role) => {
    await updateUserRoleMutation.mutateAsync({ user_email, new_role });
  };

  if (!currentStore || !storeDetails) {
    return <div className="text-center py-20">Carregando...</div>;
  }

  const isAdmin = currentStore.role === 'admin';

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Configurações</h1>
        <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
          Gerencie integrações, plano e configurações da loja
        </p>
      </div>

      <Tabs defaultValue="integrations" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 max-w-full sm:max-w-3xl">
          <TabsTrigger value="integrations" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
            <Store className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">Integrações</span>
            <span className="xs:hidden">Int.</span>
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
            <CreditCard className="w-3 h-3 sm:w-4 sm:h-4" />
            <span>Plano</span>
          </TabsTrigger>
          <TabsTrigger value="company" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
            <Building2 className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">Empresa</span>
            <span className="xs:hidden">Emp.</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm" disabled={!isAdmin}>
            <Users className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">Usuários</span>
            <span className="xs:hidden">Users</span>
          </TabsTrigger>
        </TabsList>

        {/* Integrações Tab */}
        <TabsContent value="integrations" className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {integrationsList.map(integrationInfo => {
              const existingIntegration = integrations.find(
                i => i.integration_type === integrationInfo.type
              );

              return (
                <IntegrationCard
                  key={integrationInfo.type}
                  integration={{
                    ...integrationInfo,
                    ...existingIntegration,
                    id: existingIntegration?.id
                  }}
                  isActive={existingIntegration?.status === 'connected'}
                  canConnect={canConnect && isAdmin}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                  onSync={() => handleSync(existingIntegration?.id)}
                  onCheckStatus={handleCheckStatus}
                  onTestAuth={handleTestAuth}
                  onDebugCounts={handleDebugCounts}
                  onDebugLastAuth={handleDebugLastAuth}
                  storeId={currentStore.id}
                  isAdmin={isAdmin}
                />
              );
            })}
          </div>

          {!isAdmin && (
            <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200">
              <CardContent className="p-6">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Permissão Negada:</strong> Apenas administradores podem gerenciar integrações. 
                  Entre em contato com um admin da loja para fazer alterações.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Plano Tab */}
        <TabsContent value="subscription" className="space-y-6">
          <div className="max-w-2xl">
            <SubscriptionCard
              store={storeDetails}
              onSubscribe={handleSubscribe}
            />
          </div>

          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-4 text-gray-900 dark:text-white">
                O que está incluído no plano
              </h3>
              <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                  Análise RFM completa de todos os seus clientes
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                  Curva ABC de produtos
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                  Identificação automática de clientes VIP
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                  Integrações com Nuvemshop e Bling
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                  Sincronização automática diária
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                  Até 10 usuários por loja
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dados da Empresa Tab */}
        <TabsContent value="company" className="space-y-4 md:space-y-6">
          <CompanyData 
            storeDetails={storeDetails}
            currentStore={currentStore}
            isAdmin={isAdmin}
          />
        </TabsContent>

        {/* Usuários Tab */}
        <TabsContent value="users" className="space-y-4 md:space-y-6">
          {isAdmin ? (
            <UserManagement
              storeUsers={storeUsers}
              currentUser={currentUser}
              isAdmin={isAdmin}
              onInvite={handleInviteUser}
              onRemove={handleRemoveUser}
              onUpdateRole={handleUpdateUserRole}
            />
          ) : (
            <Card>
              <CardContent className="p-8 md:p-12 text-center">
                <Users className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Permissão Necessária
                </h3>
                <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
                  Apenas administradores podem gerenciar usuários da loja.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}