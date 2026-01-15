import './App.css'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import HomeSimple from './pages/HomeSimple';
import Dashboard from './pages/Dashboard';
import RFMMatrix from './pages/RFMMatrix';
import ABCCurve from './pages/ABCCurve';
import Settings from './pages/Settings';

function App() {
  // Verificar se tem loja selecionada
  const currentStore = localStorage.getItem('currentStore');
  const hasStore = currentStore && currentStore !== 'null';

  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        {!hasStore ? (
          // Se não tem loja, mostrar apenas Home
          <Routes>
            <Route path="*" element={<HomeSimple />} />
          </Routes>
        ) : (
          // Se tem loja, mostrar app completo
          <div style={{ padding: '20px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
            <nav style={{ marginBottom: '20px', display: 'flex', gap: '15px', padding: '10px', backgroundColor: 'white', borderRadius: '8px', alignItems: 'center' }}>
              <a href="/" style={{ textDecoration: 'none', color: '#3B82F6', fontWeight: 'bold' }}>Dashboard</a>
              <a href="/RFMMatrix" style={{ textDecoration: 'none', color: '#3B82F6', fontWeight: 'bold' }}>Matriz RFM</a>
              <a href="/ABCCurve" style={{ textDecoration: 'none', color: '#3B82F6', fontWeight: 'bold' }}>Curva ABC</a>
              <a href="/Settings" style={{ textDecoration: 'none', color: '#3B82F6', fontWeight: 'bold' }}>Configurações</a>
              <button 
                onClick={() => { localStorage.removeItem('currentStore'); window.location.href = '/'; }}
                style={{ marginLeft: 'auto', padding: '5px 15px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
              >
                Trocar Loja
              </button>
            </nav>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/Dashboard" element={<Dashboard />} />
              <Route path="/RFMMatrix" element={<RFMMatrix />} />
              <Route path="/ABCCurve" element={<ABCCurve />} />
              <Route path="/Settings" element={<Settings />} />
            </Routes>
          </div>
        )}
      </Router>
    </QueryClientProvider>
  )
}

export default App
