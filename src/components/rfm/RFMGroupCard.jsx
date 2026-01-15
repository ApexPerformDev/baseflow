import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, DollarSign, TrendingUp, Calendar } from 'lucide-react';

const GROUP_STYLES = {
  'Campeões': {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-900 dark:text-blue-100',
    badge: 'bg-blue-600 dark:bg-blue-500'
  },
  'Leais': {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-900 dark:text-green-100',
    badge: 'bg-green-600 dark:bg-green-500'
  },
  'Promissores': {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800',
    text: 'text-purple-900 dark:text-purple-100',
    badge: 'bg-purple-600 dark:bg-purple-500'
  },
  'Em Risco': {
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-200 dark:border-orange-800',
    text: 'text-orange-900 dark:text-orange-100',
    badge: 'bg-orange-600 dark:bg-orange-500'
  },
  'Dormindo': {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-900 dark:text-red-100',
    badge: 'bg-red-600 dark:bg-red-500'
  },
  'Novos': {
    bg: 'bg-cyan-50 dark:bg-cyan-900/20',
    border: 'border-cyan-200 dark:border-cyan-800',
    text: 'text-cyan-900 dark:text-cyan-100',
    badge: 'bg-cyan-600 dark:bg-cyan-500'
  }
};

export default function RFMGroupCard({ group, data, onClick }) {
  const style = GROUP_STYLES[group] || GROUP_STYLES['Novos'];
  
  return (
    <Card 
      className={`${style.bg} ${style.border} border-2 hover:shadow-lg transition-all cursor-pointer`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className={`text-lg font-bold ${style.text}`}>
            {group}
          </CardTitle>
          <Badge className={`${style.badge} text-white`}>
            {data.count} clientes
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <DollarSign className="w-4 h-4" />
            <span>Faturamento</span>
          </div>
          <span className={`font-semibold ${style.text}`}>
            R$ {data.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <TrendingUp className="w-4 h-4" />
            <span>Ticket Médio</span>
          </div>
          <span className={`font-semibold ${style.text}`}>
            R$ {data.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Calendar className="w-4 h-4" />
            <span>Média Recência</span>
          </div>
          <span className={`font-semibold ${style.text}`}>
            {Math.round(data.avgRecency)} dias
          </span>
        </div>
      </CardContent>
    </Card>
  );
}