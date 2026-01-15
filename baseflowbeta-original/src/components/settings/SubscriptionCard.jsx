import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CreditCard, 
  Calendar, 
  CheckCircle, 
  AlertCircle,
  Clock,
  XCircle 
} from 'lucide-react';
import { format, differenceInHours, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function SubscriptionCard({ store, onSubscribe }) {
  const getStatusInfo = () => {
    const status = store.subscription_status;
    
    switch (status) {
      case 'TRIAL':
        const trialEnd = new Date(store.trial_end_at);
        const now = new Date();
        const hoursLeft = differenceInHours(trialEnd, now);
        const minutesLeft = differenceInMinutes(trialEnd, now);
        
        return {
          icon: Clock,
          iconColor: 'text-yellow-600',
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          borderColor: 'border-yellow-200',
          title: 'Período Trial',
          message: hoursLeft > 0 
            ? `Seu teste termina em ${hoursLeft} horas`
            : `Seu teste termina em ${minutesLeft} minutos`,
          action: 'Assinar Plano',
          showAction: true
        };
      
      case 'ACTIVE':
        return {
          icon: CheckCircle,
          iconColor: 'text-green-600',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-200',
          title: 'Assinatura Ativa',
          message: `Próxima cobrança em: ${format(new Date(store.current_period_end), 'dd/MM/yyyy', { locale: ptBR })}`,
          action: 'Gerenciar Pagamento',
          showAction: false
        };
      
      case 'EXPIRED':
        return {
          icon: XCircle,
          iconColor: 'text-red-600',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200',
          title: 'Assinatura Expirada',
          message: 'Sua assinatura expirou. Renove para continuar usando todas as funcionalidades.',
          action: 'Renovar Assinatura',
          showAction: true
        };
      
      case 'CANCELLED':
        return {
          icon: AlertCircle,
          iconColor: 'text-orange-600',
          bgColor: 'bg-orange-50 dark:bg-orange-900/20',
          borderColor: 'border-orange-200',
          title: 'Assinatura Cancelada',
          message: 'Sua assinatura foi cancelada. Reative para continuar usando o serviço.',
          action: 'Reativar Assinatura',
          showAction: true
        };
      
      default:
        return {
          icon: AlertCircle,
          iconColor: 'text-gray-600',
          bgColor: 'bg-gray-50 dark:bg-gray-900/20',
          borderColor: 'border-gray-200',
          title: 'Status Desconhecido',
          message: 'Entre em contato com o suporte.',
          action: 'Assinar Plano',
          showAction: true
        };
    }
  };

  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;

  const handleSubscribe = () => {
    // In a real scenario, this would create a Stripe checkout session
    alert('Em produção, isso redirecionaria para o Stripe Checkout. Funcionalidade em desenvolvimento.');
    onSubscribe();
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Plano & Assinatura
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className={`${statusInfo.bgColor} ${statusInfo.borderColor} border`}>
          <Icon className={`w-4 h-4 ${statusInfo.iconColor}`} />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-semibold">{statusInfo.title}</p>
              <p className="text-sm">{statusInfo.message}</p>
            </div>
          </AlertDescription>
        </Alert>

        <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
            <Badge className={
              store.subscription_status === 'ACTIVE' 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : store.subscription_status === 'TRIAL'
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            }>
              {store.subscription_status}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Plano</span>
            <span className="font-medium">{store.plan_type || 'Basic'}</span>
          </div>

          {store.subscription_status === 'TRIAL' && store.trial_end_at && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Trial termina</span>
              <span className="font-medium">
                {format(new Date(store.trial_end_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
              </span>
            </div>
          )}

          {store.subscription_status === 'ACTIVE' && store.current_period_end && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Próxima cobrança</span>
              <span className="font-medium">
                {format(new Date(store.current_period_end), 'dd/MM/yyyy', { locale: ptBR })}
              </span>
            </div>
          )}
        </div>

        {statusInfo.showAction && (
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={handleSubscribe}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            {statusInfo.action}
          </Button>
        )}

        <div className="pt-4 border-t">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Pagamentos processados via Stripe de forma segura
          </p>
        </div>
      </CardContent>
    </Card>
  );
}