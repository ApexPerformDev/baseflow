import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, Crown, Zap, Shield, CreditCard } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function Pricing() {
  const [user, setUser] = useState(null);
  const [currentStore, setCurrentStore] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser);
    const storeData = localStorage.getItem('currentStore');
    if (storeData) {
      setCurrentStore(JSON.parse(storeData));
    }
  }, []);

  const plans = [
    {
      id: 'basic',
      name: 'Básico',
      price: 'R$ 97',
      period: '/mês',
      description: 'Perfeito para pequenas empresas',
      features: [
        'Análise RFM completa',
        'Dashboard com métricas',
        'Curva ABC de produtos',
        'Até 1.000 clientes',
        'Suporte por email'
      ],
      popular: false,
      stripeId: 'price_basic_monthly'
    },
    {
      id: 'pro',
      name: 'Profissional',
      price: 'R$ 197',
      period: '/mês',
      description: 'Para empresas em crescimento',
      features: [
        'Tudo do plano Básico',
        'Integração com Nuvemshop',
        'Sincronização automática',
        'Até 10.000 clientes',
        'Relatórios avançados',
        'Suporte prioritário'
      ],
      popular: true,
      stripeId: 'price_pro_monthly'
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'R$ 397',
      period: '/mês',
      description: 'Para grandes operações',
      features: [
        'Tudo do plano Profissional',
        'Clientes ilimitados',
        'API personalizada',
        'Múltiplas integrações',
        'Suporte 24/7',
        'Gerente de conta dedicado'
      ],
      popular: false,
      stripeId: 'price_enterprise_monthly'
    }
  ];

  const handleSubscribe = async (plan) => {
    if (!user || !currentStore) {
      alert('Erro: usuário ou loja não encontrados');
      return;
    }

    setLoading(true);
    try {
      // Criar sessão do Stripe Checkout
      const response = await base44.integrations.Core.CreateStripeCheckoutSession({
        priceId: plan.stripeId,
        userId: user.id,
        storeId: currentStore.id,
        successUrl: `${window.location.origin}/Dashboard?payment=success`,
        cancelUrl: `${window.location.origin}/Pricing?payment=cancelled`
      });

      // Redirecionar para o Stripe Checkout
      window.location.href = response.url;
    } catch (error) {
      alert('Erro ao processar pagamento: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const isTrialExpired = () => {
    if (!currentStore?.trial_end_at) return false;
    return new Date() > new Date(currentStore.trial_end_at);
  };

  const getTrialDaysLeft = () => {
    if (!currentStore?.trial_end_at) return 0;
    const now = new Date();
    const trialEnd = new Date(currentStore.trial_end_at);
    const diffTime = trialEnd - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  return (
    <div className="min-h-screen bg-[#121212] py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Escolha seu Plano
          </h1>
          <p className="text-xl text-[#9F9F9F] mb-6">
            Desbloqueie todo o potencial da análise RFM
          </p>

          {/* Trial Status */}
          {currentStore?.subscription_status === 'TRIAL' && (
            <Alert className="max-w-md mx-auto bg-yellow-900/20 border-yellow-800">
              <AlertDescription className="text-yellow-200">
                {isTrialExpired() ? (
                  <strong>Trial expirado! Escolha um plano para continuar.</strong>
                ) : (
                  <strong>Trial ativo: {getTrialDaysLeft()} dia(s) restante(s)</strong>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`relative bg-[#1E1E1E] border-[#2A2A2A] ${
                plan.popular ? 'ring-2 ring-[#3B82F6]' : ''
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#3B82F6] text-white">
                  Mais Popular
                </Badge>
              )}
              
              <CardHeader className="text-center">
                <div className="w-12 h-12 rounded-lg bg-[#3B82F6] flex items-center justify-center text-white mx-auto mb-4">
                  {plan.id === 'basic' && <Zap className="w-6 h-6" />}
                  {plan.id === 'pro' && <Crown className="w-6 h-6" />}
                  {plan.id === 'enterprise' && <Shield className="w-6 h-6" />}
                </div>
                <CardTitle className="text-2xl text-white">{plan.name}</CardTitle>
                <div className="text-3xl font-bold text-white">
                  {plan.price}
                  <span className="text-lg text-[#9F9F9F] font-normal">{plan.period}</span>
                </div>
                <p className="text-[#9F9F9F]">{plan.description}</p>
              </CardHeader>

              <CardContent>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3 text-[#E5E5E5]">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleSubscribe(plan)}
                  disabled={loading}
                  className={`w-full ${
                    plan.popular 
                      ? 'bg-[#3B82F6] hover:bg-[#4C8DFF]' 
                      : 'bg-[#2A2A2A] hover:bg-[#3A3A3A] border border-[#4A4A4A]'
                  } text-white`}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {loading ? 'Processando...' : 'Assinar Agora'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Features Comparison */}
        <div className="bg-[#1E1E1E] rounded-lg p-8 border border-[#2A2A2A]">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            Todos os planos incluem
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-lg bg-[#3B82F6] flex items-center justify-center text-white mx-auto mb-4">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Segurança Total</h3>
              <p className="text-[#9F9F9F]">Seus dados protegidos com criptografia de ponta</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-lg bg-[#3B82F6] flex items-center justify-center text-white mx-auto mb-4">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Atualizações Automáticas</h3>
              <p className="text-[#9F9F9F]">Sempre com as últimas funcionalidades</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-lg bg-[#3B82F6] flex items-center justify-center text-white mx-auto mb-4">
                <Crown className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Suporte Especializado</h3>
              <p className="text-[#9F9F9F]">Equipe dedicada para te ajudar</p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-12 text-center">
          <p className="text-[#9F9F9F] mb-4">
            Dúvidas? Entre em contato conosco pelo email: 
            <a href="mailto:suporte@rfmanalytics.com" className="text-[#3B82F6] hover:text-[#4C8DFF] ml-1">
              suporte@rfmanalytics.com
            </a>
          </p>
          <p className="text-sm text-[#7A7A7A]">
            Pagamento seguro processado pelo Stripe • Cancele a qualquer momento
          </p>
        </div>
      </div>
    </div>
  );
}