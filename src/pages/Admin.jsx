import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, 
  Building2, 
  CreditCard, 
  Search, 
  Check, 
  X, 
  Crown,
  Calendar,
  Mail
} from 'lucide-react';
import { format } from 'date-fns';

export default function Admin() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      // Verificar se é admin
      if (u.email !== 'admin@rfmanalytics.com') {
        window.location.href = '/';
      }
    });
  }, []);

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['admin-stores'],
    queryFn: async () => {
      const allStores = await base44.entities.Store.list();
      return allStores.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!user
  });

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      return await base44.entities.User.list();
    },
    enabled: !!user
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ storeId, status, planType, endDate }) => {
      return await base44.entities.Store.update(storeId, {
        subscription_status: status,
        plan_type: planType,
        subscription_end_at: endDate
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-stores']);
      alert('Assinatura atualizada com sucesso!');
    }
  });

  const handleActivateSubscription = (store, planType = 'pro') => {
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1); // +1 mês

    updateSubscriptionMutation.mutate({
      storeId: store.id,
      status: 'ACTIVE',
      planType: planType,
      endDate: endDate.toISOString()
    });
  };

  const handleDeactivateSubscription = (store) => {
    updateSubscriptionMutation.mutate({
      storeId: store.id,
      status: 'EXPIRED',
      planType: store.plan_type,
      endDate: new Date().toISOString()
    });
  };

  const filteredStores = stores.filter(store => 
    store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.email_empresa?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status) => {
    const badges = {
      TRIAL: { label: 'Trial', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
      ACTIVE: { label: 'Ativa', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
      EXPIRED: { label: 'Expirada', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
      CANCELLED: { label: 'Cancelada', className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' }
    };
    const badge = badges[status] || badges.TRIAL;
    return <Badge className={badge.className}>{badge.label}</Badge>;
  };

  const getPlanBadge = (planType) => {
    const badges = {
      basic: { label: 'Básico', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
      pro: { label: 'Pro', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
      enterprise: { label: 'Enterprise', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' }
    };
    const badge = badges[planType] || badges.basic;
    return <Badge className={badge.className}>{badge.label}</Badge>;
  };

  if (!user || user.email !== 'admin@rfmanalytics.com') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>
            Acesso negado. Apenas administradores podem acessar esta página.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#1F2937] dark:text-white">
            Painel Administrativo
          </h1>
          <p className="text-[#6B7280] dark:text-[#9CA3AF] mt-1">
            Gerencie usuários e assinaturas
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white dark:bg-[#232323] border-[#E5E5E5] dark:border-[#2D2D2D]">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1F2937] dark:text-white">
                  {stores.length}
                </p>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                  Total de Lojas
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-[#232323] border-[#E5E5E5] dark:border-[#2D2D2D]">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1F2937] dark:text-white">
                  {stores.filter(s => s.subscription_status === 'ACTIVE').length}
                </p>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                  Assinaturas Ativas
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-[#232323] border-[#E5E5E5] dark:border-[#2D2D2D]">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1F2937] dark:text-white">
                  {stores.filter(s => s.subscription_status === 'TRIAL').length}
                </p>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                  Em Trial
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-[#232323] border-[#E5E5E5] dark:border-[#2D2D2D]">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <X className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1F2937] dark:text-white">
                  {stores.filter(s => ['EXPIRED', 'CANCELLED'].includes(s.subscription_status)).length}
                </p>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                  Expiradas
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stores Management */}
      <Card className="bg-white dark:bg-[#232323] border-[#E5E5E5] dark:border-[#2D2D2D]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl text-[#1F2937] dark:text-white">
              Gerenciar Lojas
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-80"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-[#6B7280] dark:text-[#9CA3AF]">Carregando...</div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredStores.map(store => (
                <div key={store.id} className="flex items-center justify-between p-4 border border-[#E5E5E5] dark:border-[#2D2D2D] rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#3B82F6] flex items-center justify-center text-white font-bold">
                      {store.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#1F2937] dark:text-white">
                        {store.name}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                        <Mail className="w-4 h-4" />
                        {store.email_empresa || 'Sem email'}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#9CA3AF] dark:text-[#6B7280]">
                        <Calendar className="w-3 h-3" />
                        Criada em {format(new Date(store.created_date), 'dd/MM/yyyy')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusBadge(store.subscription_status)}
                        {getPlanBadge(store.plan_type || 'basic')}
                      </div>
                      {store.subscription_end_at && (
                        <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                          Expira: {format(new Date(store.subscription_end_at), 'dd/MM/yyyy')}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {store.subscription_status !== 'ACTIVE' ? (
                        <Button
                          size="sm"
                          onClick={() => handleActivateSubscription(store)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          disabled={updateSubscriptionMutation.isLoading}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Ativar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeactivateSubscription(store)}
                          disabled={updateSubscriptionMutation.isLoading}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Desativar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}