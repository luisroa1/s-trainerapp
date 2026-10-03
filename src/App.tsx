import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ClientApp } from './components/client/ClientApp';
import { TrainerApp } from './components/trainer/TrainerApp';
import { AdminApp } from './components/common/AdminApp';
import { AuthScreen } from './components/common/AuthScreen';
import { Loader2 } from 'lucide-react';
import { PasswordRecovery } from './components/common/PasswordRecovery';
import { isPasswordRecoveryRoute } from './lib/passwordRecoveryRoute.mjs';

const AuthenticatedApp: React.FC = () => {
  const { supabaseUser, userRole, authLoading } = useApp();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#101012] text-[#F5F4F0] flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-[#8E8E94]">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando S-TRAINER...
        </div>
      </div>
    );
  }

  const recoveryRequested = typeof window !== 'undefined' && isPasswordRecoveryRoute(window.location);
  
  if (recoveryRequested && supabaseUser) return <PasswordRecovery />;
  if (!supabaseUser || !userRole) return <AuthScreen />;

  if (userRole === 'admin') return <AdminApp />;
  if (userRole === 'trainer') return <TrainerApp />;
  return <ClientApp />;
};

export default function App() {
  return (
    <AppProvider>
      <AuthenticatedApp />
    </AppProvider>
  );
}
