import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Link2,
  Unlink,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function IntegrationCard({
  integration,
  isActive,
  canConnect,
  onConnect,
  onDisconnect,
  onSync,
  onCheckStatus,
  onTestAuth,
  onDebugCounts,
  onDebugLastAuth,
  storeId,
  isAdmin,
}) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    api_key: "",
    store_url: "",
  });
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const queryClient = useQueryClient();

  // Polling para status de sync quando estiver rodando
  useEffect(() => {
    if (!integration?.id || integration.sync_status !== "running") {
      return;
    }

    const pollStatus = async () => {
      try {
        const response = await base44.functions.invoke("nuvemshopSyncStatus", {
          integration_id: integration.id,
        });
        const data = response.data || response;
        setSyncStatus(data);

        // Se terminou, invalidar queries para atualizar UI
        if (data.sync_status === "done" || data.sync_status === "error") {
          queryClient.invalidateQueries(["integrations"]);
        }
      } catch (error) {
        console.error("Error polling sync status:", error);
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 3000); // Poll a cada 3 segundos

    return () => clearInterval(interval);
  }, [integration?.id, integration?.sync_status, queryClient]);

  const handleConnect = async () => {
    if (integration.type === "NUVEMSHOP") {
      await handleNuvemshopOAuth();
    } else {
      setLoading(true);
      await onConnect(integration.type, formData);
      setLoading(false);
      setShowForm(false);
    }
  };

  const handleNuvemshopOAuth = async () => {
    setLoading(true);
    try {
      const response = await base44.integrations.nuvemshop.getAuthUrl({
        store_id: storeId,
      });

      const data = response.data || response;

      if (data.authUrl) {
        const width = 600;
        const height = 700;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        const popup = window.open(
          data.authUrl,
          "Nuvemshop OAuth",
          `width=${width},height=${height},left=${left},top=${top}`
        );

        const messageHandler = (event) => {
          if (event.data.success) {
            alert("Nuvemshop conectada com sucesso!");
            window.location.reload();
          } else if (event.data.error) {
            alert("Erro ao conectar: " + event.data.error);
          }
          window.removeEventListener("message", messageHandler);
        };

        window.addEventListener("message", messageHandler);
      }
    } catch (error) {
      alert("Erro ao iniciar conexão: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectIntegration = async () => {
    if (integration.type === "NUVEMSHOP") {
      setLoading(true);
      try {
        await base44.integrations.nuvemshop.invoke("disconnect", {
          store_id: storeId,
        });
        alert("Nuvemshop desconectada com sucesso!");
        window.location.reload();
      } catch (error) {
        alert("Erro ao desconectar: " + error.message);
      } finally {
        setLoading(false);
      }
    } else {
      await onDisconnect(integration.id);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      connected: {
        label: "Conectado",
        className:
          "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      },
      disconnected: {
        label: "Desconectado",
        className:
          "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
      },
      error: {
        label: "Erro",
        className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      },
      syncing: {
        label: "Sincronizando",
        className:
          "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      },
      connecting: {
        label: "Conectando",
        className:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      },
    };
    const badge = badges[status] || badges.disconnected;
    return <Badge className={badge.className}>{badge.label}</Badge>;
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            {integration.icon && (
              <integration.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            )}
            {integration.name}
          </CardTitle>
          {integration.status && getStatusBadge(integration.status)}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {integration.description}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canConnect && (
          <Alert className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription className="text-sm">
              Para conectar integrações, você precisa ter uma assinatura ativa.
              Assine um plano na aba "Plano/Assinatura".
            </AlertDescription>
          </Alert>
        )}

        {integration.type === "NUVEMSHOP" &&
          integration.status === "connected" &&
          integration.store_url && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Loja ID Nuvemshop:</strong> {integration.store_url}
              </div>
            </div>
          )}

        {/* Barra de Progresso durante Sync */}
        {integration.type === "NUVEMSHOP" &&
          integration.sync_status === "running" && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="font-medium">Sincronizando...</span>
                </div>
              </div>

              <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <div>{integration.sync_stage || "Preparando..."}</div>
                {integration.sync_total_pages > 0 && (
                  <div className="font-semibold">
                    Página {integration.sync_current_page || 0}/
                    {integration.sync_total_pages} | Importados:{" "}
                    {integration.sync_total_imported || 0}
                  </div>
                )}
                {(!integration.sync_total_pages ||
                  integration.sync_total_pages === 0) && (
                  <div className="font-semibold">
                    Página {integration.sync_current_page || 0} | Importados:{" "}
                    {integration.sync_total_imported || 0}
                  </div>
                )}
              </div>

              {/* Botões de controle */}
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                  onClick={async () => {
                    if (
                      !confirm(
                        "Deseja parar a sincronização? O progresso será mantido e você poderá continuar depois."
                      )
                    ) {
                      return;
                    }
                    setLoading(true);
                    try {
                      await base44.functions.invoke("cancelNuvemshopSync", {
                        integration_id: integration.id,
                      });
                      alert("✅ Sincronização cancelada");
                      queryClient.invalidateQueries(["integrations"]);
                    } catch (error) {
                      alert("❌ Erro ao cancelar: " + error.message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                >
                  Parar Sincronização
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  onClick={async () => {
                    if (
                      !confirm(
                        "⚠️ ATENÇÃO: Isso irá PARAR a sincronização e APAGAR TODOS os dados importados (pedidos, clientes, produtos, análises). Você precisará reconectar a integração do zero. Deseja continuar?"
                      )
                    ) {
                      return;
                    }
                    setLoading(true);
                    try {
                      await base44.functions.invoke(
                        "resetNuvemshopIntegration",
                        { integration_id: integration.id }
                      );
                      alert(
                        "✅ Reset concluído! A integração foi desconectada."
                      );
                      window.location.reload();
                    } catch (error) {
                      alert("❌ Erro ao resetar: " + error.message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading || !isAdmin}
                >
                  Parar e Resetar
                </Button>
              </div>
            </div>
          )}

        {/* Última Sync (quando não está rodando) */}
        {integration.status === "connected" &&
          integration.last_sync &&
          integration.sync_status !== "running" && (
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
                <Clock className="w-4 h-4" />
                <span>
                  Última sincronização:{" "}
                  {format(
                    new Date(integration.last_sync),
                    "dd/MM/yyyy 'às' HH:mm"
                  )}
                </span>
              </div>
            </div>
          )}

        {integration.status === "error" && integration.sync_error_message && (
          <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-red-800 dark:text-red-200">
              <AlertCircle className="w-4 h-4" />
              <span>{integration.sync_error_message}</span>
            </div>
          </div>
        )}

        {integration.status === "connected" ? (
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={onSync}
              disabled={
                !canConnect || loading || integration.sync_status === "running"
              }
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${
                  integration.sync_status === "running" ? "animate-spin" : ""
                }`}
              />
              {integration.sync_status === "running"
                ? "Sincronizando..."
                : "Sincronizar Agora"}
            </Button>

            {integration.type === "NUVEMSHOP" && onCheckStatus && (
              <Button
                variant="outline"
                className="w-full bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                onClick={onCheckStatus}
                disabled={loading}
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Verificar Status
              </Button>
            )}

            {integration.type === "NUVEMSHOP" && onTestAuth && (
              <Button
                variant="outline"
                className="w-full bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30"
                onClick={onTestAuth}
                disabled={loading}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Testar Token
              </Button>
            )}

            {integration.type === "NUVEMSHOP" && onDebugCounts && (
              <Button
                variant="outline"
                className="w-full bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30"
                onClick={onDebugCounts}
                disabled={loading}
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Ver Dados Salvos
              </Button>
            )}

            {integration.type === "NUVEMSHOP" && onDebugLastAuth && (
              <Button
                variant="outline"
                className="w-full bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                onClick={onDebugLastAuth}
                disabled={loading}
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Debug Auth
              </Button>
            )}

            {integration.type === "NUVEMSHOP" && (
              <Button
                variant="destructive"
                className="w-full bg-red-600 hover:bg-red-700"
                onClick={async () => {
                  if (
                    !confirm(
                      "⚠️ ATENÇÃO: Isso irá PARAR qualquer sincronização em andamento e APAGAR TODOS os dados importados (pedidos, clientes, produtos, análises). A integração será desconectada e você precisará reconectar do zero. Deseja continuar?"
                    )
                  ) {
                    return;
                  }
                  setLoading(true);
                  try {
                    const response = await base44.functions.invoke(
                      "resetNuvemshopIntegration",
                      { integration_id: integration.id }
                    );

                    const data = response.data || response;
                    if (data.success) {
                      alert(
                        `✅ Reset concluído!\n\nDados apagados:\n• Itens: ${data.deleted.order_items}\n• Pedidos: ${data.deleted.orders}\n• Clientes: ${data.deleted.customers}\n• Produtos: ${data.deleted.products}\n• RFM: ${data.deleted.rfm_analysis}\n• ABC: ${data.deleted.abc_analysis}\n\nA integração foi desconectada.`
                      );
                      window.location.reload();
                    } else {
                      alert("❌ Erro: " + data.error);
                    }
                  } catch (error) {
                    alert("❌ Erro ao executar reset: " + error.message);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading || !isAdmin}
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Resetar Integração
              </Button>
            )}

            <Button
              variant="destructive"
              className="w-full"
              onClick={handleDisconnectIntegration}
              disabled={loading || !isAdmin}
            >
              <Unlink className="w-4 h-4 mr-2" />
              {loading ? "Desconectando..." : "Desconectar"}
            </Button>
          </div>
        ) : (
          <>
            {!showForm ? (
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  if (integration.type === "NUVEMSHOP") {
                    handleNuvemshopOAuth();
                  } else {
                    setShowForm(true);
                  }
                }}
                disabled={!canConnect || loading}
              >
                <Link2 className="w-4 h-4 mr-2" />
                {loading ? "Conectando..." : `Conectar ${integration.name}`}
              </Button>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="store_url">URL da Loja</Label>
                  <Input
                    id="store_url"
                    placeholder={`Ex: minhaloja.${integration.type.toLowerCase()}.com`}
                    value={formData.store_url}
                    onChange={(e) =>
                      setFormData({ ...formData, store_url: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="api_key">Chave de API / Token</Label>
                  <Input
                    id="api_key"
                    type="password"
                    placeholder="Cole aqui sua chave de API"
                    value={formData.api_key}
                    onChange={(e) =>
                      setFormData({ ...formData, api_key: e.target.value })
                    }
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowForm(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    onClick={handleConnect}
                    disabled={
                      loading || !formData.api_key || !formData.store_url
                    }
                  >
                    {loading ? "Conectando..." : "Conectar"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
