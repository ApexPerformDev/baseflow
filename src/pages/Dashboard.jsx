import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  DollarSign, 
  ShoppingCart, 
  Users, 
  TrendingUp, 
  UserPlus,
  Repeat,
  Crown,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import KPICard from '../components/dashboard/KPICard';
import RFMGroupsChart from '../components/dashboard/RFMGroupsChart';
import RevenueChart from '../components/dashboard/RevenueChart';
import GroupEvolutionTable from '../components/dashboard/GroupEvolutionTable';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

export default function Dashboard() {
  const [currentStore, setCurrentStore] = useState(null);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    const storeData = localStorage.getItem('currentStore');
    if (!storeData) {
      window.location.href = '/';
      return;
    }
    setCurrentStore(JSON.parse(storeData));
  }, []);

  // Check subscription status
  const showTrialWarning = currentStore?.subscription_status === 'TRIAL';
  const showExpiredWarning = ['EXPIRED', 'CANCELLED'].includes(currentStore?.subscription_status);

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', currentStore?.id, period],
    queryFn: async () => {
      if (!currentStore?.id) return [];
      const allOrders = await base44.entities.Order.filter({ 
        store_id: currentStore.id,
        status: 'paid'
      });
      
      const days = parseInt(period);
      const cutoffDate = subDays(new Date(), days);
      
      return allOrders.filter(order => {
        const orderDate = new Date(order.order_date);
        return orderDate >= cutoffDate;
      });
    },
    enabled: !!currentStore?.id,
    refetchInterval: false,
    staleTime: 30000
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', currentStore?.id],
    queryFn: async () => {
      if (!currentStore?.id) return [];
      return await base44.entities.Customer.filter({ store_id: currentStore.id });
    },
    enabled: !!currentStore?.id
  });

  const { data: rfmAnalysis = [] } = useQuery({
    queryKey: ['rfmAnalysis', currentStore?.id],
    queryFn: async () => {
      if (!currentStore?.id) return [];
      return await base44.entities.RFMAnalysis.filter({ store_id: currentStore.id });
    },
    enabled: !!currentStore?.id
  });

  // Calculate KPIs
  const totalRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
  const totalOrders = orders.length;
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const uniqueCustomers = new Set(orders.map(o => o.customer_id)).size;
  
  const days = parseInt(period);
  const cutoffDate = subDays(new Date(), days);
  const newCustomers = customers.filter(c => {
    const regDate = new Date(c.registration_date);
    return regDate >= cutoffDate;
  }).length;

  // Calculate repurchase rate
  const customerOrderCount = {};
  orders.forEach(order => {
    customerOrderCount[order.customer_id] = (customerOrderCount[order.customer_id] || 0) + 1;
  });
  const repeatCustomers = Object.values(customerOrderCount).filter(count => count > 1).length;
  const repurchaseRate = uniqueCustomers > 0 ? (repeatCustomers / uniqueCustomers) * 100 : 0;

  // VIP customers
  const vipCount = rfmAnalysis.filter(r => r.is_vip).length;

  // RFM Groups distribution
  const rfmGroupsData = rfmAnalysis.reduce((acc, item) => {
    const existing = acc.find(g => g.group === item.rfm_group);
    if (existing) {
      existing.count++;
    } else {
      acc.push({ group: item.rfm_group, count: 1 });
    }
    return acc;
  }, []);

  // Revenue over time
  const revenueByDay = orders.reduce((acc, order) => {
    const date = format(new Date(order.order_date), 'dd/MM');
    const existing = acc.find(d => d.date === date);
    if (existing) {
      existing.revenue += order.total_amount;
    } else {
      acc.push({ date, revenue: order.total_amount });
    }
    return acc;
  }, []);
  revenueByDay.sort((a, b) => {
    const [dayA, monthA] = a.date.split('/');
    const [dayB, monthB] = b.date.split('/');
    return new Date(2024, monthA - 1, dayA) - new Date(2024, monthB - 1, dayB);
  });

  // Mock evolution data (in real scenario, would compare with historical data)
  const groupEvolutionData = [
    { group: 'Campeões', current: rfmAnalysis.filter(r => r.rfm_group === 'Campeões').length, entered: 12, exited: 8 },
    { group: 'Leais', current: rfmAnalysis.filter(r => r.rfm_group === 'Leais').length, entered: 15, exited: 10 },
    { group: 'Promissores', current: rfmAnalysis.filter(r => r.rfm_group === 'Promissores').length, entered: 20, exited: 5 },
    { group: 'Em Risco', current: rfmAnalysis.filter(r => r.rfm_group === 'Em Risco').length, entered: 8, exited: 12 },
    { group: 'Dormindo', current: rfmAnalysis.filter(r => r.rfm_group === 'Dormindo').length, entered: 5, exited: 15 },
    { group: 'Novos', current: rfmAnalysis.filter(r => r.rfm_group === 'Novos').length, entered: 25, exited: 3 }
  ];

  if (!currentStore) {
    return <div className="text-center py-20">Carregando...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1F2937] dark:text-white">Dashboard</h1>
          <p className="text-sm md:text-base text-[#6B7280] dark:text-[#9CA3AF] mt-1">
            Visão geral do desempenho da sua loja
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="365">Últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Trial/Expired Warning */}
      {showTrialWarning && (
        <Alert className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            <strong>Período Trial:</strong> Você está em período de teste. Para habilitar integrações e sincronização automática de dados, assine um plano nas configurações.
          </AlertDescription>
        </Alert>
      )}
      
      {showExpiredWarning && (
        <Alert className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <AlertDescription className="text-red-800 dark:text-red-200">
            <strong>Assinatura Expirada:</strong> Sua assinatura não está ativa. Renove seu plano nas configurações para continuar usando todas as funcionalidades.
          </AlertDescription>
        </Alert>
      )}

      {/* Empty State */}
      {!ordersLoading && orders.length === 0 && (
        <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <strong>Nenhum dado encontrado:</strong> Conecte uma integração e sincronize seus dados em Configurações → Integrações.
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <KPICard
          title="Faturamento Total"
          value={`R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          loading={ordersLoading}
        />
        <KPICard
          title="Pedidos"
          value={totalOrders.toLocaleString('pt-BR')}
          icon={ShoppingCart}
          loading={ordersLoading}
        />
        <KPICard
          title="Ticket Médio"
          value={`R$ ${avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={TrendingUp}
          loading={ordersLoading}
        />
        <KPICard
          title="Clientes Únicos"
          value={uniqueCustomers.toLocaleString('pt-BR')}
          icon={Users}
          loading={ordersLoading}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <KPICard
          title="Novos Clientes"
          value={newCustomers.toLocaleString('pt-BR')}
          icon={UserPlus}
        />
        <KPICard
          title="Clientes que Recompraram"
          value={repeatCustomers.toLocaleString('pt-BR')}
          icon={Repeat}
        />
        <KPICard
          title="Taxa de Recompra"
          value={`${repurchaseRate.toFixed(1)}%`}
          icon={Repeat}
        />
        <KPICard
          title="Clientes VIP"
          value={vipCount.toLocaleString('pt-BR')}
          icon={Crown}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <RevenueChart data={revenueByDay} loading={ordersLoading} />
        <RFMGroupsChart data={rfmGroupsData} loading={false} />
      </div>

      {/* Group Evolution Table */}
      <GroupEvolutionTable data={groupEvolutionData} loading={false} />
    </div>
  );
}