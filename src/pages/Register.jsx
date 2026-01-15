import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (formData.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      // Registrar usuário
      await base44.auth.register({
        email: formData.email,
        password: formData.password,
        name: formData.name
      });

      // Fazer login automático
      await base44.auth.login(formData.email, formData.password);
      
      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-[#1E1E1E] border-[#2A2A2A]">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-lg bg-[#3B82F6] flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
            R
          </div>
          <CardTitle className="text-2xl text-white">Criar Conta</CardTitle>
          <p className="text-[#9F9F9F]">Comece seu trial gratuito de 1 dia</p>
        </CardHeader>
        <CardContent>
          {/* Trial Benefits */}
          <div className="mb-6 p-4 bg-[#3B82F6]/10 border border-[#3B82F6]/20 rounded-lg">
            <h3 className="text-[#3B82F6] font-semibold mb-2">✨ Trial Gratuito Inclui:</h3>
            <ul className="space-y-1 text-sm text-[#E5E5E5]">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Análise RFM completa
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Dashboard com métricas
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Curva ABC de produtos
              </li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[#E5E5E5]">Nome Completo</Label>
              <Input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                placeholder="Seu nome completo"
                required
                className="bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-[#7A7A7A] focus:border-[#3B82F6]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#E5E5E5]">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="seu@email.com"
                required
                className="bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-[#7A7A7A] focus:border-[#3B82F6]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#E5E5E5]">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Mínimo 6 caracteres"
                  required
                  className="bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-[#7A7A7A] focus:border-[#3B82F6] pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A7A7A] hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-[#E5E5E5]">Confirmar Senha</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirme sua senha"
                  required
                  className="bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-[#7A7A7A] focus:border-[#3B82F6] pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A7A7A] hover:text-white"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="bg-red-900/20 border-red-800">
                <AlertDescription className="text-red-200">{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full bg-[#3B82F6] hover:bg-[#4C8DFF] text-white"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando conta...
                </>
              ) : (
                'Começar Trial Gratuito'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[#9F9F9F]">
              Já tem uma conta?{' '}
              <Link to="/Login" className="text-[#3B82F6] hover:text-[#4C8DFF] font-medium">
                Fazer login
              </Link>
            </p>
          </div>

          <p className="text-xs text-[#7A7A7A] text-center mt-4">
            Ao criar uma conta, você concorda com nossos Termos de Uso
          </p>
        </CardContent>
      </Card>
    </div>
  );
}