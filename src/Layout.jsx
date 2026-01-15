import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  Settings, 
  User as UserIcon,
  X,
  Search,
  Plus,
  Building2,
  Crown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import SubscriptionExpired from '@/components/SubscriptionExpired';
import { useAuth } from '@/lib/AuthContext';

export default function Layout({ children, currentPageName }) {
  const [currentStore, setCurrentStore] = useState(null);
  const [user, setUser] = useState(null);
  const [showStoreDrawer, setShowStoreDrawer] = useState(false);
  const [allStores, setAllStores] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [theme, setTheme] = useState('dark');
  const { logout } = useAuth();

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    
    base44.auth.me().then(setUser);
    
    const storeData = localStorage.getItem('currentStore');
    if (storeData) {
      setCurrentStore(JSON.parse(storeData));
    }
    
    loadUserStores();
  }, []);

  const loadUserStores = async () => {
    try {
      const u = await base44.auth.me();
      if (!u) return;
      
      const storeUsers = await base44.entities.StoreUser.filter({ user_email: u.email });
      const allStoresData = await base44.entities.Store.list();
      const userStores = allStoresData.filter(s => 
        storeUsers.some(su => su.store_id === s.id)
      );
      setAllStores(userStores);
      
      // Atualizar currentStore se existir
      if (currentStore) {
        const updatedCurrentStore = userStores.find(s => s.id === currentStore.id);
        if (updatedCurrentStore) {
          const storeUserRole = storeUsers.find(su => su.store_id === currentStore.id);
          const newStoreData = {
            ...updatedCurrentStore,
            role: storeUserRole?.role || currentStore.role
          };
          
          setCurrentStore(newStoreData);
          localStorage.setItem('currentStore', JSON.stringify(newStoreData));
        }
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

  const handleSelectStore = (store) => {
    const storeUsers = JSON.parse(localStorage.getItem('storeUsers') || '[]');
    const userRole = storeUsers.find(su => su.store_id === store.id && su.user_email === user?.email);
    
    localStorage.setItem('currentStore', JSON.stringify({
      id: store.id,
      name: store.name,
      subscription_status: store.subscription_status,
      trial_end_at: store.trial_end_at,
      subscription_end_at: store.subscription_end_at,
      logo_url: store.logo_url,
      role: userRole?.role || 'basic'
    }));
    setShowStoreDrawer(false);
    window.location.href = createPageUrl('Dashboard');
  };

  // Verificar se a assinatura expirou
  const isSubscriptionExpired = () => {
    if (!currentStore) return false;
    
    // Trial expirado
    if (currentStore.subscription_status === 'TRIAL' && currentStore.trial_end_at) {
      return new Date() > new Date(currentStore.trial_end_at);
    }
    
    // Assinatura expirada
    if (['EXPIRED', 'CANCELLED'].includes(currentStore.subscription_status)) {
      return true;
    }
    
    return false;
  };

  const canAccessNuvemshop = () => {
    if (!currentStore) return false;
    return currentStore.subscription_status === 'ACTIVE';
  };

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: 'Dashboard' },
    { name: 'Matriz RFM', icon: Users, path: 'RFMMatrix' },
    { name: 'Curva ABC', icon: Package, path: 'ABCCurve' },
    { name: 'Configurações', icon: Settings, path: 'Settings' }
  ];

  // Adicionar Admin para usuário admin
  if (user?.email === 'apexperformgw@gmail.com') {
    menuItems.push({ name: 'Admin', icon: Crown, path: 'Admin' });
  }

  const publicPages = ['Login', 'Register', 'Pricing'];
  if (publicPages.includes(currentPageName)) {
    return <div className="min-h-screen">{children}</div>;
  }

  // Verificar se precisa bloquear acesso
  if (currentStore && isSubscriptionExpired() && !publicPages.includes(currentPageName) && currentPageName !== 'Pricing' && user?.email !== 'apexperformgw@gmail.com') {
    return <SubscriptionExpired currentStore={currentStore} />;
  }

  const filteredStores = allStores.filter(store => 
    store.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-[#1A1A1A]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-[70px] bg-white dark:bg-[#1C1C1C] border-r border-[#E5E5E5] dark:border-[#2D2D2D] z-50 flex flex-col items-center py-6">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-10 h-10 rounded-lg bg-[#3B82F6] flex items-center justify-center text-white font-bold text-xl shadow-md">
            R
          </div>
        </div>

        {/* Store Avatar */}
        {currentStore && (
          <button
            onClick={() => setShowStoreDrawer(true)}
            className="mb-6 w-10 h-10 rounded-full bg-[#3B82F6] flex items-center justify-center text-white font-semibold hover:bg-[#4C8DFF] transition-colors overflow-hidden relative"
          >
            {currentStore.logo_url ? (
              <img src={currentStore.logo_url} alt={currentStore.name} className="w-full h-full object-cover" />
            ) : (
              currentStore.name.charAt(0).toUpperCase()
            )}
            {/* Indicador de status */}
            <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
              currentStore.subscription_status === 'ACTIVE' ? 'bg-green-500' :
              currentStore.subscription_status === 'TRIAL' ? 'bg-yellow-500' :
              'bg-red-500'
            }`}></div>
          </button>
        )}

        {/* Divider */}
        <div className="w-8 h-[1px] bg-[#E5E5E5] dark:bg-[#2D2D2D] mb-6"></div>

        {/* Navigation Icons */}
        <nav className="flex-1 flex flex-col gap-2 w-full px-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPageName === item.path;
            return (
              <Link
                key={item.path}
                to={createPageUrl(item.path)}
                className={`flex items-center justify-center h-12 rounded-lg transition-all ${
                  isActive
                    ? 'bg-[#3B82F6] text-white'
                    : 'text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#2D2D2D] hover:text-[#1F2937] dark:hover:text-[#FFFFFF]'
                }`}
                title={item.name}
              >
                <Icon className="w-5 h-5" />
              </Link>
            );
          })}
        </nav>

        {/* User Avatar */}
        {user && (
          <button
            onClick={logout}
            className="w-10 h-10 rounded-full bg-[#E5E5E5] dark:bg-[#2D2D2D] flex items-center justify-center text-[#1F2937] dark:text-white text-sm font-medium hover:bg-[#D1D5DB] dark:hover:bg-[#3A3A3A] transition-colors overflow-hidden"
            title="Sair"
          >
            {user.profile_picture ? (
              <img src={user.profile_picture} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              user.email?.charAt(0).toUpperCase()
            )}
          </button>
        )}
      </aside>

      {/* Store Drawer */}
      {showStoreDrawer && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-[60]"
            onClick={() => setShowStoreDrawer(false)}
          />
          <div className="fixed left-[70px] top-0 h-screen w-[300px] bg-white dark:bg-[#232323] shadow-2xl z-[70] animate-slide-in-left border-r border-[#E5E5E5] dark:border-[#2D2D2D]">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-4 border-b border-[#E5E5E5] dark:border-[#2D2D2D] flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#1F2937] dark:text-white">Empresas</h2>
                <button
                  onClick={() => setShowStoreDrawer(false)}
                  className="p-1 hover:bg-[#F3F4F6] dark:hover:bg-[#2D2D2D] rounded"
                >
                  <X className="w-5 h-5 text-[#6B7280] dark:text-[#9CA3AF]" />
                </button>
              </div>

              {/* Search */}
              <div className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
                  <input
                    type="text"
                    placeholder="Pesquisar empresa"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-[#F9FAFB] dark:bg-[#1E1E1E] border border-[#E5E5E5] dark:border-[#2D2D2D] rounded-lg text-[#1F2937] dark:text-white placeholder-[#6B7280] dark:placeholder-[#9CA3AF] focus:border-[#3B82F6] focus:outline-none"
                  />
                </div>
              </div>

              {/* Stores List */}
              <div className="flex-1 overflow-y-auto px-2">
                {filteredStores.map(store => (
                  <button
                    key={store.id}
                    onClick={() => handleSelectStore(store)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors mb-1 ${
                      currentStore?.id === store.id
                        ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/20 border border-[#3B82F6]'
                        : 'hover:bg-[#F3F4F6] dark:hover:bg-[#2D2D2D]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-[#3B82F6] flex items-center justify-center text-white font-semibold flex-shrink-0 overflow-hidden relative">
                      {store.logo_url ? (
                        <img src={store.logo_url} alt={store.name} className="w-full h-full object-cover" />
                      ) : (
                        store.name.charAt(0).toUpperCase()
                      )}
                      <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${
                        store.subscription_status === 'ACTIVE' ? 'bg-green-500' :
                        store.subscription_status === 'TRIAL' ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}></div>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-[#1F2937] dark:text-white font-medium text-sm">{store.name}</div>
                      <div className="text-[#6B7280] dark:text-[#9CA3AF] text-xs">
                        {store.subscription_status === 'ACTIVE' ? 'Ativa' :
                         store.subscription_status === 'TRIAL' ? 'Trial' : 'Expirada'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Add Store Button */}
              <div className="p-4 border-t border-[#E5E5E5] dark:border-[#2D2D2D]">
                <Link
                  to={createPageUrl('Home')}
                  onClick={() => {
                    localStorage.removeItem('currentStore');
                    setShowStoreDrawer(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar empresa
                </Link>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <div className="ml-[70px]">
        <main className="p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}