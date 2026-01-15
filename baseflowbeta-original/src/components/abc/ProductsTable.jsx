import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProductCard from './ProductCard';

const GROUP_STYLES = {
  'A': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200',
  'B': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-200',
  'C': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200'
};

export default function ProductsTable({ 
  products, 
  abcData,
  searchTerm,
  onSearchChange,
  groupFilter,
  onGroupFilterChange
}) {
  // Combinar produtos com dados ABC
  const productsWithABC = abcData.map(abc => {
    const product = products.find(p => p.id === abc.product_id);
    return {
      ...abc,
      name: product?.name || 'Produto Desconhecido',
      sku: product?.sku || '',
      category: product?.category || ''
    };
  });

  // Filtrar produtos
  const filteredProducts = productsWithABC.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesGroup = groupFilter === 'all' || item.group_abc === groupFilter;
    
    return matchesSearch && matchesGroup;
  });

  // Ordenar por receita (decrescente)
  const sortedProducts = filteredProducts.sort((a, b) => b.total_revenue - a.total_revenue);

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-base md:text-lg font-semibold">
          Produtos ({sortedProducts.length})
        </CardTitle>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-4">
          <div className="flex-1 w-full relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por nome ou SKU..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 text-sm"
            />
          </div>
          
          <Tabs value={groupFilter} onValueChange={onGroupFilterChange} className="w-full sm:w-auto">
            <TabsList className="grid grid-cols-4 w-full sm:w-auto">
              <TabsTrigger value="all" className="text-xs sm:text-sm">Todos</TabsTrigger>
              <TabsTrigger value="A" className="text-xs sm:text-sm text-green-700">A</TabsTrigger>
              <TabsTrigger value="B" className="text-xs sm:text-sm text-yellow-700">B</TabsTrigger>
              <TabsTrigger value="C" className="text-xs sm:text-sm text-red-700">C</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                <TableHead>SKU</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-center">Qtd Vendida</TableHead>
                <TableHead className="text-center">Faturamento</TableHead>
                <TableHead className="text-center">% Participação</TableHead>
                <TableHead className="text-center">% Acumulado</TableHead>
                <TableHead className="text-center">Grupo ABC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProducts.map(item => (
                <TableRow key={item.product_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <TableCell className="font-mono text-sm">
                    {item.sku || '-'}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {item.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {item.category || '-'}
                    </span>
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {(item.quantity_sold || 0).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-center font-medium text-green-600 dark:text-green-400">
                    R$ {(item.total_revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-medium">
                      {(item.revenue_percentage || 0).toFixed(2)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-medium text-blue-600 dark:text-blue-400">
                      {(item.accumulated_percentage || 0).toFixed(2)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={`${GROUP_STYLES[item.group_abc]} border font-bold`}>
                      {item.group_abc}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {sortedProducts.map(item => (
            <ProductCard 
              key={item.product_id} 
              product={{
                id: item.product_id,
                name: item.name,
                sku: item.sku,
                category: item.category
              }}
              abc={item}
            />
          ))}
        </div>
        
        {sortedProducts.length === 0 && (
          <div className="text-center py-12 text-sm md:text-base text-gray-500 dark:text-gray-400">
            Nenhum produto encontrado com os filtros aplicados
          </div>
        )}
      </CardContent>
    </Card>
  );
}