import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '../utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Store, Plus, ArrowRight, Shield, User as UserIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import CreateStoreDialog from '../components/store/CreateStoreDialog';

export default function Home() {
  const [user, setUser] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => setUser(u)).catch(() => {
      window.location.href = '/';
    });
  }, []);

  const { data: storeUsers = [], isLoading } = useQuery({
    queryKey: ['storeUsers', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return await base44.entities.StoreUser.filter({ user_email: user.email });
    },
    enabled: !!user?.email
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['stores', storeUsers],
    queryFn: async () => {
      if (storeUsers.length === 0) return [];
      const storeIds = storeUsers.map(su => su.store_id);
      const allStores = await base44.entities.Store.list();
      return allStores.filter(s => storeIds.includes(s.id));
    },
    enabled: storeUsers.length > 0
  });

  const getStoreRole = (storeId) => {
    const storeUser = storeUsers.find(su => su.store_id === storeId);
    return storeUser?.role || 'basic';
  };

  const createStoreMutation = useMutation({
    mutationFn: async (storeData) => {
      // Criar a loja com trial de 1 dia
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +1 dia

      const store = await base44.entities.Store.create({
        ...storeData,
        subscription_status: 'TRIAL',
        trial_start_at: now.toISOString(),
        trial_end_at: trialEnd.toISOString(),
        plan_type: 'basic'
      });

      // Criar vínculo do usuário como admin
      await base44.entities.StoreUser.create({
        store_id: store.id,
        user_email: user.email,
        role: 'admin',
        accepted_at: now.toISOString()
      });

      return store;
    },
    onSuccess: async (store) => {
      await queryClient.invalidateQueries({ queryKey: ['storeUsers'] });
      await queryClient.invalidateQueries({ queryKey: ['stores'] });
      
      // Redirecionar automaticamente para o dashboard com role admin
      localStorage.setItem('currentStore', JSON.stringify({
        id: store.id,
        name: store.name,
        subscription_status: store.subscription_status,
        role: 'admin'
      }));
      window.location.href = createPageUrl('Dashboard');
    }
  });

  const handleCreateStore = async (formData) => {
    await createStoreMutation.mutateAsync(formData);
  };

  const getSubscriptionBadge = (status) => {
    const badges = {
      TRIAL: { label: 'Trial', variant: 'secondary', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
      ACTIVE: { label: 'Ativa', variant: 'default', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
      EXPIRED: { label: 'Expirada', variant: 'destructive', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
      CANCELLED: { label: 'Cancelada', variant: 'secondary', className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' }
    };
    const badge = badges[status] || badges.TRIAL;
    return <Badge className={badge.className}>{badge.label}</Badge>;
  };

  const handleSelectStore = (store) => {
    localStorage.setItem('currentStore', JSON.stringify({
      id: store.id,
      name: store.name,
      subscription_status: store.subscription_status,
      role: getStoreRole(store.id)
    }));
    window.location.href = createPageUrl('Dashboard');
  };

  return (
    <div className="min-h-screen bg-[#121212]">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              {user && (
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white text-lg font-medium">
                  {user.email?.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Selecione uma Empresa
                </h1>
                <p className="text-sm text-[#9F9F9F]">
                  Escolha uma empresa para acessar o sistema
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={() => base44.auth.logout()} 
              className="bg-transparent border-[#2A2A2A] text-[#E5E5E5] hover:bg-[#1E1E1E]"
            >
              Sair
            </Button>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <input
              type="text"
              placeholder="Pesquisar empresa"
              className="w-full px-4 py-3 pl-10 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-white placeholder-[#7A7A7A] focus:outline-none focus:border-[#3B82F6]"
              value=""
              readOnly
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A7A7A]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Stores List */}
        <div className="mb-8">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-[#1E1E1E] rounded-lg p-4 border border-[#2A2A2A]">
                  <Skeleton className="h-6 w-3/4 mb-2 bg-[#2A2A2A]" />
                  <Skeleton className="h-4 w-1/2 bg-[#2A2A2A]" />
                </div>
              ))}
            </div>
          ) : stores.length === 0 ? (
            <Card className="text-center py-12 bg-[#1E1E1E] border-[#2A2A2A]">
              <CardContent>
                <Store className="w-16 h-16 mx-auto mb-4 text-[#7A7A7A]" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  Nenhuma empresa encontrada
                </h3>
                <p className="text-[#9F9F9F] mb-6">
                  Você ainda não tem acesso a nenhuma empresa.
                </p>
                <Button 
                  className="bg-[#3B82F6] hover:bg-[#4C8DFF] text-white"
                  onClick={() => setShowCreateDialog(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeira Empresa
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {stores.map(store => {
                const firstLetter = store.name.charAt(0).toUpperCase();
                return (
                  <button
                    key={store.id}
                    onClick={() => handleSelectStore(store)}
                    className="w-full flex items-center gap-3 p-4 rounded-lg bg-[#1E1E1E] border border-[#2A2A2A] hover:bg-[#2A2A2A] transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#3B82F6] flex items-center justify-center text-white font-bold flex-shrink-0">
                      {firstLetter}
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-semibold text-white group-hover:text-[#4C8DFF]">
                        {store.name}
                      </h3>
                      <p className="text-sm text-[#9F9F9F]">
                        Plano {store.plan_type || 'Starter'}
                      </p>
                    </div>
                    {store.subscription_status === 'ACTIVE' && (
                      <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Add Store Button */}
        <button
          onClick={() => setShowCreateDialog(true)}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-[#2A2A2A] hover:border-[#3B82F6] hover:bg-[#1E1E1E] transition-all text-[#7A7A7A] hover:text-[#3B82F6]"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Adicionar empresa</span>
        </button>

        {/* Create Store Dialog */}
        <CreateStoreDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={handleCreateStore}
        />
      </div>
    </div>
  );
}