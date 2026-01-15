import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowUpCircle, ArrowDownCircle, Users } from 'lucide-react';

const GROUP_COLORS = {
  'Campeões': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'Leais': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'Promissores': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  'Em Risco': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  'Dormindo': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  'Novos': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200'
};

export default function GroupEvolutionTable({ data, loading }) {
  if (loading) {
    return (
      <Card className="bg-white dark:bg-[#232323] border-[#E5E5E5] dark:border-[#2D2D2D]">
        <CardHeader>
          <CardTitle>Evolução por Grupo RFM</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-12 bg-[#F3F4F6] dark:bg-[#1E1E1E] rounded animate-pulse"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow bg-white dark:bg-[#232323] border-[#E5E5E5] dark:border-[#2D2D2D]">
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-base md:text-lg font-semibold text-[#1F2937] dark:text-white flex items-center gap-2">
          <Users className="w-4 h-4 md:w-5 md:h-5 text-[#3B82F6]" />
          Evolução por Grupo RFM
        </CardTitle>
        <p className="text-xs md:text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1">
          Movimentação de clientes entre grupos no período selecionado
        </p>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <Table className="min-w-[600px] md:min-w-0">
            <TableHeader>
              <TableRow className="bg-[#F9FAFB] dark:bg-[#1E1E1E] border-b border-[#E5E5E5] dark:border-[#2D2D2D]">
                <TableHead className="font-semibold text-xs md:text-sm text-[#374151] dark:text-[#E5E5E5]">Grupo RFM</TableHead>
                <TableHead className="text-center font-semibold text-xs md:text-sm text-[#374151] dark:text-[#E5E5E5]">Total Atual</TableHead>
                <TableHead className="text-center font-semibold text-xs md:text-sm text-[#374151] dark:text-[#E5E5E5]">Entraram</TableHead>
                <TableHead className="text-center font-semibold text-xs md:text-sm text-[#374151] dark:text-[#E5E5E5]">Saíram</TableHead>
                <TableHead className="text-center font-semibold text-xs md:text-sm text-[#374151] dark:text-[#E5E5E5]">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => {
                const balance = row.entered - row.exited;
                return (
                  <TableRow key={row.group} className="hover:bg-[#F9FAFB] dark:hover:bg-[#1E1E1E] border-b border-[#E5E5E5] dark:border-[#2D2D2D]">
                    <TableCell>
                      <Badge className={GROUP_COLORS[row.group] || 'bg-gray-100'}>
                        {row.group}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium text-[#1F2937] dark:text-[#E5E5E5]">
                      {row.current}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 text-[#10B981] dark:text-[#34D399]">
                        <ArrowUpCircle className="w-4 h-4" />
                        <span className="font-medium">{row.entered}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 text-[#EF4444] dark:text-[#F87171]">
                        <ArrowDownCircle className="w-4 h-4" />
                        <span className="font-medium">{row.exited}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-semibold ${
                        balance > 0 
                          ? 'text-[#10B981] dark:text-[#34D399]' 
                          : balance < 0 
                          ? 'text-[#EF4444] dark:text-[#F87171]'
                          : 'text-[#6B7280] dark:text-[#9CA3AF]'
                      }`}>
                        {balance > 0 ? '+' : ''}{balance}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}