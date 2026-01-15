import React, { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

const AuthSuccess = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Pega os parâmetros da URL que o backend enviou
    const success = searchParams.get("success") === "true";
    const error = searchParams.get("error");

    // Envia mensagem para a janela pai (IntegrationCard)
    if (window.opener) {
      window.opener.postMessage(
        {
          success: success,
          error: error,
        },
        "*"
      );

      // Fecha o popup automaticamente
      window.close();
    }
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
      <div className="text-center p-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
          Conectando...
        </h2>
        <p className="text-gray-500">
          Por favor, aguarde enquanto finalizamos a conexão.
        </p>
      </div>
    </div>
  );
};

export default AuthSuccess;
