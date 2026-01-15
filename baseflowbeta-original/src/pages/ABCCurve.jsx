import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, TrendingUp, Package, DollarSign } from 'lucide-react';
import ParetoChart from '../components/abc/ParetoChart';
import ProductsTable from '../components/abc/ProductsTable';

export default function ABCCurve() {
  const [currentStore, setCurrentStore] = useState(null);
  const [period, setPeriod] = useState('90');
  const [searchTerm, setSearchTerm] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');

  useEffect(() => {
    const storeData = localStorage.getItem('currentStore');
    if (!storeData) {
      window.location.href = '/';
      return;
    }
    setCurrentStore(JSON.parse(storeData));
  }, []);

  const { data: abcAnalysis = [], isLoading } = useQuery({
    queryKey: ['abcAnalysis', currentStore?.id],
    queryFn: async () => {
      if (!currentStore?.id) return [];
      return await base44.entities.ABCAnalysis.filter({ store_id: currentStore.id });
    },
    enabled: !!currentStore?.id,
    refetchInterval: false,
    staleTime: 30000
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', currentStore?.id],
    queryFn: async () => {
      if (!currentStore?.id) return [];
      return await base44.entities.Product.filter({ store_id: currentStore.id });
    },
    enabled: !!currentStore?.id,
    refetchInterval: false,
    staleTime: 30000
  });

  // Calculate summary stats
  const groupA = abcAnalysis.filter(a => a.group_abc === 'A');
  const groupB = abcAnalysis.filter(a => a.group_abc === 'B');
  const groupC = abcAnalysis.filter(a => a.group_abc === 'C');

  const totalRevenue = abcAnalysis.reduce((sum, a) => sum + a.total_revenue, 0);
  const revenueA = groupA.reduce((sum, a) => sum + a.total_revenue, 0);
  const revenueB = groupB.reduce((sum, a) => sum + a.total_revenue, 0);
  const revenueC = groupC.reduce((sum, a) => sum + a.total_revenue, 0);

  // Prepare data for Pareto chart (top 20 products)
  const sortedAbc = [...abcAnalysis].sort((a, b) => b.total_revenue - a.total_revenue);
  const top20 = sortedAbc.slice(0, 20);
  
  const paretoData = top20.map((abc, index) => {
    const product = products.find(p => p.id === abc.product_id);
    return {
      name: product?.name.substring(0, 15) + '...' || 'Produto',
      revenue: abc.total_revenue,
      accumulated: abc.accumulated_percentage
    };
  });

  if (!currentStore) {
    return <div className="text-center py-20">Carregando...</div>;
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Curva ABC</h1>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
            Análise de produtos por faturamento e classificação ABC
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="180">Últimos 6 meses</SelectItem>
              <SelectItem value="365">Últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card className="border-l-4 border-l-blue-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Total de Produtos
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {products.length}
                </p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Grupo A ({groupA.length})
                </p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {totalRevenue > 0 ? ((revenueA / totalRevenue) * 100).toFixed(1) : 0}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  R$ {revenueA.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Grupo B ({groupB.length})
                </p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {totalRevenue > 0 ? ((revenueB / totalRevenue) * 100).toFixed(1) : 0}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  R$ {revenueB.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Grupo C ({groupC.length})
                </p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {totalRevenue > 0 ? ((revenueC / totalRevenue) * 100).toFixed(1) : 0}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  R$ {revenueC.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <DollarSign className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pareto Chart */}
      {paretoData.length > 0 && (
        <ParetoChart data={paretoData} />
      )}

      {/* Products Table */}
      {abcAnalysis.length > 0 && (
        <ProductsTable
          products={products}
          abcData={abcAnalysis}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          groupFilter={groupFilter}
          onGroupFilterChange={setGroupFilter}
        />
      )}

      {/* Empty State */}
      {!isLoading && abcAnalysis.length === 0 && (
        <Card className="text-center py-20">
          <CardContent>
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Nenhum dado ABC disponível
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Conecte uma integração e sincronize produtos e pedidos para visualizar a curva ABC
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