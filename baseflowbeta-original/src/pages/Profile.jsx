import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogOut, Upload } from 'lucide-react';
import { format } from 'date-fns';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: ''
  });

  useEffect(() => {
    loadUser();
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
  }, []);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      setFormData({
        full_name: userData.full_name || '',
        phone: userData.phone || '',
        email: userData.email
      });
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await base44.auth.updateMe({
        full_name: formData.full_name,
        phone: formData.phone
      });
      alert('Perfil atualizado com sucesso!');
      loadUser();
    } catch (error) {
      alert('Erro ao atualizar perfil: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.auth.updateMe({ profile_picture: file_url });
      await loadUser();
      alert('Foto de perfil atualizada com sucesso!');
    } catch (error) {
      alert('Erro ao fazer upload da foto: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-[#7A7A7A]">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Card */}
      <Card className="bg-white dark:bg-[#232323] border-[#E5E5E5] dark:border-[#2D2D2D]">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-[#3B82F6] flex items-center justify-center text-white text-3xl font-bold shadow-lg overflow-hidden">
                {user.profile_picture ? (
                  <img src={user.profile_picture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  user.email?.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#1F2937] dark:text-white mb-1">
                  {user.full_name || 'Sem nome'}
                </h1>
                <p className="text-[#6B7280] dark:text-[#9CA3AF] mb-1">{user.email}</p>
                <p className="text-sm text-[#9CA3AF] dark:text-[#6B7280]">
                  Membro desde {format(new Date(user.created_date), 'dd/MM/yyyy')}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => base44.auth.logout()}
              className="bg-transparent border-[#E5E5E5] dark:border-[#2D2D2D] text-[#374151] dark:text-[#E5E5E5] hover:bg-[#F3F4F6] dark:hover:bg-[#2D2D2D]"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card className="bg-white dark:bg-[#232323] border-[#E5E5E5] dark:border-[#2D2D2D]">
        <CardHeader>
          <CardTitle className="text-xl text-[#1F2937] dark:text-white">Informações Pessoais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-2">Nome Completo</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="bg-white dark:bg-[#1E1E1E] border-[#E5E5E5] dark:border-[#2D2D2D] text-[#1F2937] dark:text-white placeholder-[#9CA3AF] dark:placeholder-[#6B7280] focus:border-[#3B82F6]"
                placeholder="Seu nome completo"
              />
            </div>
            <div>
              <Label className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-2">Telefone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="bg-white dark:bg-[#1E1E1E] border-[#E5E5E5] dark:border-[#2D2D2D] text-[#1F2937] dark:text-white placeholder-[#9CA3AF] dark:placeholder-[#6B7280] focus:border-[#3B82F6]"
                placeholder="+55 (11) 99999-9999"
              />
            </div>
          </div>
          <div>
            <Label className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-2">Email</Label>
            <Input
              value={formData.email}
              disabled
              className="bg-[#F9FAFB] dark:bg-[#1E1E1E] border-[#E5E5E5] dark:border-[#2D2D2D] text-[#9CA3AF] dark:text-[#6B7280] cursor-not-allowed"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              className="bg-transparent border-[#E5E5E5] dark:border-[#2D2D2D] text-[#374151] dark:text-[#E5E5E5] hover:bg-[#F3F4F6] dark:hover:bg-[#2D2D2D]"
            >
              Alterar senha
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              className="bg-[#3B82F6] hover:bg-[#2563EB] text-white shadow-sm"
            >
              {loading ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Profile Picture */}
      <Card className="bg-white dark:bg-[#232323] border-[#E5E5E5] dark:border-[#2D2D2D]">
        <CardHeader>
          <CardTitle className="text-xl text-[#1F2937] dark:text-white">Foto de Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-[#3B82F6] flex items-center justify-center text-white text-4xl font-bold shadow-lg overflow-hidden">
              {user.profile_picture ? (
                <img src={user.profile_picture} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                user.email?.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                id="photo-upload"
                disabled={loading}
              />
              <label 
                htmlFor="photo-upload"
                className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[#E5E5E5] dark:border-[#2D2D2D] bg-transparent text-[#374151] dark:text-[#E5E5E5] hover:bg-[#F3F4F6] dark:hover:bg-[#2D2D2D] transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <Upload className="w-4 h-4" />
                {loading ? 'Enviando...' : 'Escolher arquivo'}
              </label>
            </div>
          </div>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            Recomendado: imagem quadrada com no mínimo 400x400px
          </p>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card className="bg-white dark:bg-[#232323] border-[#E5E5E5] dark:border-[#2D2D2D]">
        <CardHeader>
          <CardTitle className="text-xl text-[#1F2937] dark:text-white">Preferências</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <Label className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-2">Tema</Label>
            <div className="flex gap-3 mt-2">
              <button 
                onClick={() => handleThemeChange('dark')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  theme === 'dark' 
                    ? 'bg-[#3B82F6] text-white shadow-sm' 
                    : 'bg-[#F3F4F6] dark:bg-[#2D2D2D] text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#E5E5E5] dark:hover:bg-[#3A3A3A]'
                }`}
              >
                Escuro
              </button>
              <button 
                onClick={() => handleThemeChange('light')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  theme === 'light' 
                    ? 'bg-[#3B82F6] text-white shadow-sm' 
                    : 'bg-[#F3F4F6] dark:bg-[#2D2D2D] text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#E5E5E5] dark:hover:bg-[#3A3A3A]'
                }`}
              >
                Claro
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}