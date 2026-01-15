import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Calendar, ShoppingBag, DollarSign, Crown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function CustomerCard({ customer }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
              {customer.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
              {customer.email}
            </p>
          </div>
          {customer.is_vip && (
            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 ml-2 flex-shrink-0">
              <Crown className="w-3 h-3 mr-1" />
              VIP
            </Badge>
          )}
        </div>

        {/* Location */}
        {(customer.city || customer.state) && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">
              {customer.city && customer.state 
                ? `${customer.city}, ${customer.state}` 
                : customer.city || customer.state}
            </span>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400">Última compra</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {customer.last_purchase_date 
                  ? format(new Date(customer.last_purchase_date), 'dd/MM/yy', { locale: ptBR })
                  : '-'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400">Pedidos</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {customer.frequency || 0}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total gasto</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                R$ {(customer.monetary || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-4 h-4 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400">RFM</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {customer.rfm_code || '-'}
              </p>
            </div>
          </div>
        </div>

        {/* RFM Scores */}
        <div className="flex gap-2">
          <Badge variant="outline" className="text-xs">R: {customer.r_score}</Badge>
          <Badge variant="outline" className="text-xs">F: {customer.f_score}</Badge>
          <Badge variant="outline" className="text-xs">M: {customer.m_score}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}