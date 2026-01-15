import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Crown, Search, Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import CustomerCard from './CustomerCard';

export default function CustomerTable({ 
  customers, 
  rfmData, 
  searchTerm, 
  onSearchChange,
  showVipOnly,
  onVipFilterChange,
  onClose
}) {
  const filteredCustomers = customers.filter(customer => {
    const rfm = rfmData.find(r => r.customer_id === customer.id);
    if (!rfm) return false;
    
    const matchesSearch = 
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesVip = !showVipOnly || rfm.is_vip;
    
    return matchesSearch && matchesVip;
  });

  return (
    <Card className="mt-6">
      <CardHeader className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-3 md:mb-0">
          <CardTitle className="text-base md:text-lg font-semibold">
            Clientes ({filteredCustomers.length})
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 text-sm"
            />
          </div>
          
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <Checkbox 
              id="vip-filter"
              checked={showVipOnly}
              onCheckedChange={onVipFilterChange}
            />
            <label htmlFor="vip-filter" className="text-xs md:text-sm font-medium cursor-pointer flex items-center gap-1">
              <Crown className="w-3 h-3 md:w-4 md:h-4 text-yellow-600" />
              Apenas VIP
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                <TableHead>Cliente</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead className="text-center">Última Compra</TableHead>
                <TableHead className="text-center">Nº Pedidos</TableHead>
                <TableHead className="text-center">Faturamento</TableHead>
                <TableHead className="text-center">RFM</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map(customer => {
                const rfm = rfmData.find(r => r.customer_id === customer.id);
                if (!rfm) return null;
                
                return (
                  <TableRow key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {customer.name}
                          {rfm.is_vip && (
                            <Crown className="inline w-4 h-4 ml-2 text-yellow-600" />
                          )}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {customer.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {customer.city && customer.state 
                          ? `${customer.city}, ${customer.state}`
                          : customer.state || '-'
                        }
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm">
                        {rfm.last_purchase_date 
                          ? format(new Date(rfm.last_purchase_date), 'dd/MM/yyyy')
                          : '-'
                        }
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {rfm.frequency}
                    </TableCell>
                    <TableCell className="text-center font-medium text-green-600 dark:text-green-400">
                      R$ {rfm.monetary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono">
                        {rfm.rfm_code}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {rfm.is_vip && (
                        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          VIP
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {filteredCustomers.map(customer => {
            const rfm = rfmData.find(r => r.customer_id === customer.id);
            if (!rfm) return null;
            return (
              <CustomerCard 
                key={customer.id} 
                customer={{
                  ...customer,
                  ...rfm
                }}
              />
            );
          })}
        </div>
        
        {filteredCustomers.length === 0 && (
          <div className="text-center py-12 text-sm md:text-base text-gray-500 dark:text-gray-400">
            Nenhum cliente encontrado com os filtros aplicados
          </div>
        )}
      </CardContent>
    </Card>
  );
}