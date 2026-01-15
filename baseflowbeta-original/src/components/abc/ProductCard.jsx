import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, TrendingUp, DollarSign } from 'lucide-react';

const GROUP_STYLES = {
  'A': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'B': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'C': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
};

export default function ProductCard({ product, abc }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {product?.sku || 'N/A'}
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2">
              {product?.name || 'Produto sem nome'}
            </h3>
          </div>
          <Badge className={`${GROUP_STYLES[abc.group_abc]} ml-2 flex-shrink-0`}>
            {abc.group_abc}
          </Badge>
        </div>

        {/* Category */}
        {product?.category && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 truncate">
            {product.category}
          </p>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Package className="w-3 h-3 text-gray-400" />
              <p className="text-xs text-gray-500 dark:text-gray-400">Quantidade</p>
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {abc.quantity_sold?.toLocaleString('pt-BR') || 0}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-1 mb-1">
              <DollarSign className="w-3 h-3 text-gray-400" />
              <p className="text-xs text-gray-500 dark:text-gray-400">Faturamento</p>
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              R$ {(abc.total_revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp className="w-3 h-3 text-gray-400" />
              <p className="text-xs text-gray-500 dark:text-gray-400">% Receita</p>
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {(abc.revenue_percentage || 0).toFixed(2)}%
            </p>
          </div>

          <div>
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp className="w-3 h-3 text-gray-400" />
              <p className="text-xs text-gray-500 dark:text-gray-400">% Acumulado</p>
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {(abc.accumulated_percentage || 0).toFixed(2)}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}