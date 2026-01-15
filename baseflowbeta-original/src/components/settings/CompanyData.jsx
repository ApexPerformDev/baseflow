import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';

export default function CompanyData({ storeDetails, currentStore, isAdmin }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: storeDetails?.name || '',
    email_empresa: storeDetails?.email_empresa || '',
    cpf_cnpj: storeDetails?.cpf_cnpj || '',
    endereco: storeDetails?.endereco || ''
  });
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (storeDetails) {
      setFormData({
        name: storeDetails.name || '',
        email_empresa: storeDetails.email_empresa || '',
        cpf_cnpj: storeDetails.cpf_cnpj || '',
        endereco: storeDetails.endereco || ''
      });
    }
  }, [storeDetails]);

  const updateStoreMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.Store.update(currentStore.id, data);
    },
    onSuccess: (updatedStore) => {
      queryClient.invalidateQueries(['store']);
      localStorage.setItem('currentStore', JSON.stringify({
        ...currentStore,
        name: updatedStore.name
      }));
      alert('Informações da empresa atualizadas com sucesso!');
    }
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateStoreMutation.mutateAsync(formData);
    } catch (error) {
      alert('Erro ao atualizar empresa: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Store.update(currentStore.id, { logo_url: file_url });
      
      const updatedStoreData = { ...currentStore, logo_url: file_url };
      localStorage.setItem('currentStore', JSON.stringify(updatedStoreData));
      
      await queryClient.refetchQueries(['store']);
      
      alert('Logo atualizado com sucesso!');
    } catch (error) {
      alert('Erro ao fazer upload do logo: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!storeDetails) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[#7A7A7A]">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="bg-white dark:bg-[#232323] border-[#E5E5E5] dark:border-[#2D2D2D]">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-[#3B82F6] flex items-center justify-center text-white text-3xl font-bold shadow-lg overflow-hidden">
                {storeDetails.logo_url ? (
                  <img src={storeDetails.logo_url} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  storeDetails.name?.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#1F2937] dark:text-white mb-1">
                  {storeDetails.name}
                </h1>
                <p className="text-[#6B7280] dark:text-[#9CA3AF] mb-1">
                  {storeDetails.email_empresa || 'Sem email cadastrado'}
                </p>
                <p className="text-sm text-[#9CA3AF] dark:text-[#6B7280]">
                  Criada em {format(new Date(storeDetails.created_date), 'dd/MM/yyyy')}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!isAdmin && (
        <Alert className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            <strong>Apenas Visualização:</strong> Apenas administradores podem editar as informações da empresa.
          </AlertDescription>
        </Alert>
      )}

      {/* Company Information */}
      <Card className="bg-white dark:bg-[#232323] border-[#E5E5E5] dark:border-[#2D2D2D]">
        <CardHeader>
          <CardTitle className="text-xl text-[#1F2937] dark:text-white">Informações da Empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-2">Nome da Empresa</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-white dark:bg-[#1E1E1E] border-[#E5E5E5] dark:border-[#2D2D2D] text-[#1F2937] dark:text-white placeholder-[#9CA3AF] dark:placeholder-[#6B7280] focus:border-[#3B82F6]"
                placeholder="Nome da sua empresa"
                disabled={!isAdmin}
              />
            </div>
            <div>
              <Label className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-2">Email da Empresa</Label>
              <Input
                value={formData.email_empresa}
                onChange={(e) => setFormData({ ...formData, email_empresa: e.target.value })}
                className="bg-white dark:bg-[#1E1E1E] border-[#E5E5E5] dark:border-[#2D2D2D] text-[#1F2937] dark:text-white placeholder-[#9CA3AF] dark:placeholder-[#6B7280] focus:border-[#3B82F6]"
                placeholder="email@empresa.com"
                disabled={!isAdmin}
              />
            </div>
          </div>
          <div>
            <Label className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-2">CPF/CNPJ</Label>
            <Input
              value={formData.cpf_cnpj}
              onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
              className="bg-white dark:bg-[#1E1E1E] border-[#E5E5E5] dark:border-[#2D2D2D] text-[#1F2937] dark:text-white placeholder-[#9CA3AF] dark:placeholder-[#6B7280] focus:border-[#3B82F6]"
              placeholder="00.000.000/0000-00"
              disabled={!isAdmin}
            />
          </div>
          <div>
            <Label className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-2">Endereço Completo</Label>
            <Input
              value={formData.endereco}
              onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
              className="bg-white dark:bg-[#1E1E1E] border-[#E5E5E5] dark:border-[#2D2D2D] text-[#1F2937] dark:text-white placeholder-[#9CA3AF] dark:placeholder-[#6B7280] focus:border-[#3B82F6]"
              placeholder="Rua, número, bairro, cidade - UF"
              disabled={!isAdmin}
            />
          </div>
          {isAdmin && (
            <div className="flex justify-end gap-3 pt-4">
              <Button
                onClick={handleSave}
                disabled={loading}
                className="bg-[#3B82F6] hover:bg-[#2563EB] text-white shadow-sm"
              >
                {loading ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logo Upload */}
      <Card className="bg-white dark:bg-[#232323] border-[#E5E5E5] dark:border-[#2D2D2D]">
        <CardHeader>
          <CardTitle className="text-xl text-[#1F2937] dark:text-white">Logo da Empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-[#3B82F6] flex items-center justify-center text-white text-4xl font-bold shadow-lg overflow-hidden">
              {storeDetails.logo_url ? (
                <img src={storeDetails.logo_url} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                storeDetails.name?.charAt(0).toUpperCase()
              )}
            </div>
            {isAdmin && (
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                  disabled={loading}
                />
                <label 
                  htmlFor="logo-upload"
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[#E5E5E5] dark:border-[#2D2D2D] bg-transparent text-[#374151] dark:text-[#E5E5E5] hover:bg-[#F3F4F6] dark:hover:bg-[#2D2D2D] transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <Upload className="w-4 h-4" />
                  {loading ? 'Enviando...' : 'Escolher arquivo'}
                </label>
              </div>
            )}
          </div>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            Recomendado: imagem quadrada com no mínimo 400x400px
          </p>
        </CardContent>
      </Card>

      {/* Danger Zone - Only for Admins */}
      {isAdmin && (
        <Card className="bg-white dark:bg-[#232323] border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="text-xl text-red-600 dark:text-red-400">Zona de Perigo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Ao excluir a empresa, todos os dados associados serão permanentemente removidos. Esta ação não pode ser desfeita.
            </p>
            <Button
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => alert('Funcionalidade de exclusão será implementada')}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir Empresa
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}