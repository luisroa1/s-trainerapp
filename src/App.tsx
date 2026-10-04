import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ClientApp } from './components/client/ClientApp';
import { TrainerApp } from './components/trainer/TrainerApp';
import { AdminApp } from './components/common/AdminApp';
import { AuthScreen } from './components/common/AuthScreen';
import { Loader2 } from 'lucide-react';
import { PasswordRecovery } from './components/common/PasswordRecovery';
import { isPasswordRecoveryRoute } from './lib/passwordRecoveryRoute.mjs';
import { resolveAppView } from './lib/profileRole.mjs';

const AuthenticatedApp: React.FC = () => {
  const { supabaseUser, userRole, authLoading, profileRoleStatus, profileRoleError, retryProfileRoleResolution, signOut } = useApp();

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
  const view = resolveAppView({
    recoveryRequested,
    hasUser: !!supabaseUser,
    roleStatus: profileRoleStatus,
    role: userRole,
  });

  if (view === 'recovery') return <PasswordRecovery />;
  if (view === 'auth') return <AuthScreen />;
  if (view === 'profile-loading') {
    return <div role="status" className="min-h-screen bg-[#101012] text-[#F5F4F0] flex items-center justify-center text-sm text-[#8E8E94]">Verificando tu perfil...</div>;
  }
  if (view === 'profile-error') {
    return (
      <main className="min-h-screen bg-[#101012] text-[#F5F4F0] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p role="alert" className="max-w-md text-sm text-[#D1D1D6]">{profileRoleError || 'No se pudo validar tu perfil. Reintenta o cierra sesión.'}</p>
        <div className="flex gap-3">
          <button type="button" onClick={() => void retryProfileRoleResolution()} className="rounded-xl bg-[#CFFF5C] px-4 py-2 font-semibold text-[#101012]">Reintentar</button>
          <button type="button" onClick={() => void signOut()} className="rounded-xl border border-[#3A3A40] px-4 py-2">Cerrar sesión</button>
        </div>
      </main>
    );
  }
  if (view === 'admin') return <AdminApp />;
  if (view === 'trainer') return <TrainerApp />;
  return <ClientApp />;
};

export default function App() {
  return (
    <AppProvider>
      <AuthenticatedApp />
    </AppProvider>
  );
}
