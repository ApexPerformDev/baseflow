import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function KPICard({ title, value, icon: Icon, trend, loading }) {
  if (loading) {
    return (
      <Card className="hover:shadow-md transition-shadow bg-white dark:bg-[#232323] border-[#E5E5E5] dark:border-[#2D2D2D]">
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-[#E5E5E5] dark:bg-[#2D2D2D] rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-[#E5E5E5] dark:bg-[#2D2D2D] rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-all bg-white dark:bg-[#232323] border-[#E5E5E5] dark:border-[#2D2D2D]">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs md:text-sm font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-2">
              {title}
            </p>
            <p className="text-2xl md:text-3xl font-bold text-[#1F2937] dark:text-white break-words">
              {value}
            </p>
            {trend && (
              <div className="flex items-center mt-3">
                {trend.direction === 'up' ? (
                  <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400 mr-1" />
                )}
                <span className={`text-sm font-medium ${
                  trend.direction === 'up' 
                    ? 'text-[#10B981] dark:text-[#34D399]' 
                    : 'text-[#EF4444] dark:text-[#F87171]'
                }`}>
                  {trend.value}
                </span>
                <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] ml-1">
                  vs período anterior
                </span>
              </div>
            )}
          </div>
          {Icon && (
            <div className="ml-2 md:ml-4 p-2 md:p-3 bg-[#EFF6FF] dark:bg-[#1E3A8A]/20 rounded-lg flex-shrink-0">
              <Icon className="w-5 h-5 md:w-6 md:h-6 text-[#3B82F6]" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}