import React, { useState } from 'react';

export default function Home() {
  const [storeName, setStoreName] = useState('');

  const handleCreateStore = (e) => {
    e.preventDefault();
    if (!storeName.trim()) return;

    const fakeStore = {
      id: Date.now().toString(),
      name: storeName,
      subscription_status: 'ACTIVE',
      role: 'admin'
    };

    localStorage.setItem('currentStore', JSON.stringify(fakeStore));
    window.location.href = '/';
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#121212', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{ 
        maxWidth: '500px', 
        width: '100%', 
        backgroundColor: '#1E1E1E', 
        padding: '40px', 
        borderRadius: '12px',
        border: '1px solid #2A2A2A'
      }}>
        <h1 style={{ color: 'white', marginBottom: '10px', fontSize: '24px' }}>
          Bem-vindo ao RFM Analytics
        </h1>
        <p style={{ color: '#9F9F9F', marginBottom: '30px' }}>
          Crie sua primeira empresa para começar
        </p>

        <form onSubmit={handleCreateStore}>
          <label style={{ color: '#E5E5E5', display: 'block', marginBottom: '8px', fontSize: '14px' }}>
            Nome da Empresa
          </label>
          <input
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="Ex: Minha Loja"
            required
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#1A1A1A',
              border: '1px solid #2A2A2A',
              borderRadius: '8px',
              color: 'white',
              marginBottom: '20px',
              fontSize: '16px'
            }}
          />

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Criar Empresa
          </button>
        </form>

        <p style={{ color: '#7A7A7A', marginTop: '20px', fontSize: '12px', textAlign: 'center' }}>
          Modo local - Dados apenas para teste
        </p>
      </div>
    </div>
  );
}
