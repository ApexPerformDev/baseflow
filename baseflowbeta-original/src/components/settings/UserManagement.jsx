import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Users, UserPlus, Shield, Trash2, Mail, Crown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function UserManagement({ storeUsers, currentUser, isAdmin, onInvite, onRemove, onUpdateRole }) {
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('basic');
  const [loading, setLoading] = useState(false);
  const [userToRemove, setUserToRemove] = useState(null);
  const [userToUpdate, setUserToUpdate] = useState(null);

  const handleInvite = async () => {
    if (!inviteEmail) return;

    setLoading(true);
    try {
      await onInvite(inviteEmail, inviteRole);
      setInviteEmail('');
      setInviteRole('basic');
      setShowInviteDialog(false);
    } catch (error) {
      alert('Erro ao convidar usuário: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!userToRemove) return;

    setLoading(true);
    try {
      await onRemove(userToRemove.user_email);
      setUserToRemove(null);
    } catch (error) {
      alert('Erro ao remover usuário: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (newRole) => {
    if (!userToUpdate) return;

    setLoading(true);
    try {
      await onUpdateRole(userToUpdate.user_email, newRole);
      setUserToUpdate(null);
    } catch (error) {
      alert('Erro ao atualizar papel: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Users className="w-4 h-4 md:w-5 md:h-5 text-blue-600 dark:text-blue-400" />
                Usuários da Loja ({storeUsers.length})
              </CardTitle>
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">
                Gerencie quem tem acesso a esta loja
              </p>
            </div>
            {isAdmin && (
              <Button
                onClick={() => setShowInviteDialog(true)}
                className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto text-sm"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Convidar Usuário
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Users List */}
      <div className="grid grid-cols-1 gap-3 md:gap-4">
        {storeUsers.map((storeUser) => {
          const isCurrentUser = storeUser.user_email === currentUser?.email;
          const isUserAdmin = storeUser.role === 'admin';

          return (
            <Card key={storeUser.id} className={isCurrentUser ? 'border-blue-500 dark:border-blue-400' : ''}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  {/* Avatar */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium flex-shrink-0">
                      {storeUser.user_email.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm md:text-base text-gray-900 dark:text-white truncate">
                          {storeUser.user_email}
                        </p>
                        {isCurrentUser && (
                          <Badge variant="outline" className="text-xs">Você</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge className={isUserAdmin 
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }>
                          {isUserAdmin ? (
                            <>
                              <Shield className="w-3 h-3 mr-1" />
                              Admin
                            </>
                          ) : (
                            'Básico'
                          )}
                        </Badge>
                        {storeUser.invited_by && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Convidado por {storeUser.invited_by}
                          </span>
                        )}
                      </div>
                      {storeUser.accepted_at && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Desde {format(new Date(storeUser.accepted_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {isAdmin && !isCurrentUser && (
                    <div className="flex items-center gap-2 sm:justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUserToUpdate(storeUser)}
                        className="flex-1 sm:flex-none text-xs"
                      >
                        Alterar Papel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setUserToRemove(storeUser)}
                        className="flex-1 sm:flex-none text-xs"
                      >
                        <Trash2 className="w-3 h-3 sm:mr-2" />
                        <span className="hidden sm:inline">Remover</span>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {storeUsers.length === 0 && (
        <Card>
          <CardContent className="p-8 md:p-12 text-center">
            <Users className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Nenhum usuário vinculado
            </h3>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
              Convide membros da equipe para acessar esta loja
            </p>
          </CardContent>
        </Card>
      )}

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Convidar Usuário
            </DialogTitle>
            <DialogDescription>
              Envie um convite para um novo usuário acessar esta loja
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email do Usuário</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@email.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Papel na Loja</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <div>
                        <p className="font-medium">Usuário Básico</p>
                        <p className="text-xs text-gray-500">Pode visualizar dados</p>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      <div>
                        <p className="font-medium">Administrador</p>
                        <p className="text-xs text-gray-500">Acesso total + gerenciar usuários</p>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInviteDialog(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleInvite}
              disabled={!inviteEmail || loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Enviando...' : 'Enviar Convite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove User Dialog */}
      <AlertDialog open={!!userToRemove} onOpenChange={() => setUserToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{userToRemove?.user_email}</strong> desta loja?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Update Role Dialog */}
      <AlertDialog open={!!userToUpdate} onOpenChange={() => setUserToUpdate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar Papel do Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Alterar o papel de <strong>{userToUpdate?.user_email}</strong>:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleUpdateRole('basic')}
              disabled={loading || userToUpdate?.role === 'basic'}
            >
              <Users className="w-4 h-4 mr-2" />
              Usuário Básico
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleUpdateRole('admin')}
              disabled={loading || userToUpdate?.role === 'admin'}
            >
              <Shield className="w-4 h-4 mr-2" />
              Administrador
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}