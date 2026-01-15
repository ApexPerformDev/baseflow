import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreditCard, Clock, Crown } from 'lucide-react';

export default function SubscriptionExpired({ currentStore }) {
  const isTrialExpired = currentStore?.subscription_status === 'TRIAL' && 
    new Date() > new Date(currentStore.trial_end_at);
  
  const isSubscriptionExpired = ['EXPIRED', 'CANCELLED'].includes(currentStore?.subscription_status);

  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-[#1E1E1E] border-[#2A2A2A]">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-lg bg-red-600 flex items-center justify-center text-white mx-auto mb-4">
            {isTrialExpired ? <Clock className="w-8 h-8" /> : <CreditCard className="w-8 h-8" />}
          </div>
          <CardTitle className="text-2xl text-white">
            {isTrialExpired ? 'Trial Expirado' : 'Assinatura Inativa'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="bg-red-900/20 border-red-800">
            <AlertDescription className="text-red-200">
              {isTrialExpired ? (
                <>
                  Seu período de trial de <strong>{currentStore?.name}</strong> expirou. 
                  Para continuar usando todas as funcionalidades, escolha um plano.
                </>
              ) : (
                <>
                  A assinatura da loja <strong>{currentStore?.name}</strong> não está ativa. 
                  Renove seu plano para continuar.
                </>
              )}
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white mb-2">
                O que você perdeu:
              </h3>
              <ul className="text-sm text-[#9F9F9F] space-y-1">
                <li>• Análise RFM completa</li>
                <li>• Dashboard com métricas</li>
                <li>• Integração com Nuvemshop</li>
                <li>• Relatórios avançados</li>
              </ul>
            </div>

            <div className="space-y-3">
              <Link to="/Pricing">
                <Button className="w-full bg-[#3B82F6] hover:bg-[#4C8DFF] text-white">
                  <Crown className="w-4 h-4 mr-2" />
                  Ver Planos e Preços
                </Button>
              </Link>

              <Button
                variant="outline"
                className="w-full bg-transparent border-[#2A2A2A] text-[#E5E5E5] hover:bg-[#1E1E1E]"
                onClick={() => {
                  localStorage.removeItem('currentStore');
                  window.location.href = '/';
                }}
              >
                Voltar para Seleção de Lojas
              </Button>
            </div>
          </div>

          <div className="text-center">
            <p className="text-xs text-[#7A7A7A]">
              Dúvidas? Entre em contato: 
              <a href="mailto:suporte@rfmanalytics.com" className="text-[#3B82F6] hover:text-[#4C8DFF] ml-1">
                suporte@rfmanalytics.com
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}