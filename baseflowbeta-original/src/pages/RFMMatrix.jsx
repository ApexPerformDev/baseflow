import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import RFMGroupCard from '../components/rfm/RFMGroupCard';
import CustomerTable from '../components/rfm/CustomerTable';
import SalesByStateChart from '../components/rfm/SalesByStateChart';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function RFMMatrix() {
  const [currentStore, setCurrentStore] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showVipOnly, setShowVipOnly] = useState(false);

  useEffect(() => {
    const storeData = localStorage.getItem('currentStore');
    if (!storeData) {
      window.location.href = '/';
      return;
    }
    setCurrentStore(JSON.parse(storeData));
  }, []);

  const { data: rfmAnalysis = [], isLoading } = useQuery({
    queryKey: ['rfmAnalysis', currentStore?.id],
    queryFn: async () => {
      if (!currentStore?.id) return [];
      return await base44.entities.RFMAnalysis.filter({ store_id: currentStore.id });
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
    enabled: !!currentStore?.id,
    refetchInterval: false,
    staleTime: 30000
  });

  // Calculate group statistics
  const rfmGroups = ['Campeões', 'Leais', 'Promissores', 'Em Risco', 'Dormindo', 'Novos'];
  
  const groupStats = rfmGroups.map(group => {
    const groupData = rfmAnalysis.filter(r => r.rfm_group === group);
    const count = groupData.length;
    const revenue = groupData.reduce((sum, r) => sum + r.monetary, 0);
    const avgTicket = count > 0 ? revenue / count : 0;
    const avgRecency = count > 0 
      ? groupData.reduce((sum, r) => sum + r.recency_days, 0) / count 
      : 0;

    return {
      group,
      count,
      revenue,
      avgTicket,
      avgRecency
    };
  });

  // Sales by state
  const salesByState = customers.reduce((acc, customer) => {
    if (!customer.state) return acc;
    
    const customerRfm = rfmAnalysis.find(r => r.customer_id === customer.id);
    if (!customerRfm) return acc;

    const existing = acc.find(s => s.state === customer.state);
    if (existing) {
      existing.revenue += customerRfm.monetary;
      existing.customers++;
    } else {
      acc.push({
        state: customer.state,
        revenue: customerRfm.monetary,
        customers: 1
      });
    }
    return acc;
  }, []);
  
  salesByState.sort((a, b) => b.revenue - a.revenue);
  const topStates = salesByState.slice(0, 10);

  const selectedGroupCustomers = selectedGroup
    ? customers.filter(c => {
        const rfm = rfmAnalysis.find(r => r.customer_id === c.id);
        return rfm?.rfm_group === selectedGroup;
      })
    : [];

  const selectedGroupRfm = selectedGroup
    ? rfmAnalysis.filter(r => r.rfm_group === selectedGroup)
    : [];

  if (!currentStore) {
    return <div className="text-center py-20">Carregando...</div>;
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Matriz RFM</h1>
        <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
          Segmentação de clientes por Recência, Frequência e Valor Monetário
        </p>
      </div>

      {/* RFM Groups Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-48 bg-gray-200 dark:bg-gray-700 rounded"></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {groupStats.map(stats => (
            <RFMGroupCard
              key={stats.group}
              group={stats.group}
              data={stats}
              onClick={() => setSelectedGroup(stats.group)}
            />
          ))}
        </div>
      )}

      {/* Customer Table (shown when group is selected) */}
      {selectedGroup && (
        <CustomerTable
          customers={selectedGroupCustomers}
          rfmData={selectedGroupRfm}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          showVipOnly={showVipOnly}
          onVipFilterChange={setShowVipOnly}
          onClose={() => {
            setSelectedGroup(null);
            setSearchTerm('');
            setShowVipOnly(false);
          }}
        />
      )}

      {/* Sales by State Chart */}
      {topStates.length > 0 && (
        <SalesByStateChart data={topStates} />
      )}

      {/* Empty State */}
      {!isLoading && rfmAnalysis.length === 0 && (
        <Card className="text-center py-20">
          <CardContent>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Nenhum dado RFM disponível
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Conecte uma integração e sincronize seus dados para visualizar a análise RFM
            </p>
            <Button 
              onClick={() => window.location.href = '/#/Settings?tab=integrations'}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Ir para Configurações
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}