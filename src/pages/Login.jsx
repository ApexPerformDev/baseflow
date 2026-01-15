import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // O base44.auth.login já salva o token no localStorage internamente
      await base44.auth.login(formData.email, formData.password);
      
      // Usamos navigate('/') em vez de window.location.href para evitar
      // refresh total da página e perda de estado do React Router
      navigate('/');
    } catch (err) {
      console.error("Erro no login:", err);
      setError(err.message || 'Erro ao fazer login. Verifique suas credenciais.');
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
          <CardTitle className="text-2xl text-white">Entrar</CardTitle>
          <p className="text-[#9F9F9F]">Acesse sua conta do RFM Analytics</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  placeholder="Sua senha"
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
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[#9F9F9F]">
              Não tem uma conta?{' '}
              <Link to="/Register" className="text-[#3B82F6] hover:text-[#4C8DFF] font-medium">
                Criar conta
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}