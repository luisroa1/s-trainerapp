import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ClientApp } from './components/client/ClientApp';
import { TrainerApp } from './components/trainer/TrainerApp';
import { AdminApp } from './components/common/AdminApp';
import { AuthScreen } from './components/common/AuthScreen';
import { ClientActivate } from './components/client/ClientActivate';
import { Loader2 } from 'lucide-react';
import { PasswordRecovery } from './components/common/PasswordRecovery';
import { isPasswordRecoveryRoute } from './lib/passwordRecoveryRoute.mjs';
import { resolveAppView } from './lib/profileRole.mjs';

const AuthenticatedApp: React.FC = () => {
  const {
    supabaseUser, userRole, authLoading, accountAccessStatus, accountAccessError,
    retryAccountAccessResolution, profileRoleStatus, profileRoleError,
    retryProfileRoleResolution, signOut,
  } = useApp();

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
  const activationRequested = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('flow') === 'activate';
  const view = resolveAppView({
    recoveryRequested,
    activationRequested,
    hasUser: !!supabaseUser,
    accessStatus: accountAccessStatus,
    roleStatus: profileRoleStatus,
    role: userRole,
  });

  if (view === 'recovery') return <PasswordRecovery />;
  if (view === 'activation') {
    return (
      <ClientActivate
        onFinishActivation={() => { void retryAccountAccessResolution(); }}
        onGoToLogin={() => { void signOut(); }}
      />
    );
  }
  if (view === 'auth') return <AuthScreen />;
  if (view === 'access-loading') {
    return <div role="status" className="min-h-screen bg-[#101012] text-[#F5F4F0] flex items-center justify-center text-sm text-[#8E8E94]">Verificando el acceso de tu cuenta...</div>;
  }
  if (view === 'access-pending' || view === 'access-suspended' || view === 'access-error') {
    const message = view === 'access-pending'
      ? 'Tu cuenta todavía no está activada. Si recibiste una invitación, utiliza el enlace de activación de tu correo.'
      : view === 'access-suspended'
        ? 'El acceso a esta cuenta está suspendido. Contacta con soporte si necesitas ayuda.'
        : accountAccessError || 'No se pudo verificar el acceso de esta cuenta.';
    return (
      <main className="min-h-screen bg-[#101012] text-[#F5F4F0] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p role={view === 'access-error' ? 'alert' : undefined} className="max-w-md text-sm text-[#D1D1D6]">{message}</p>
        {view === 'access-error' && <button type="button" onClick={() => void retryAccountAccessResolution()} className="rounded-xl bg-[#CFFF5C] px-4 py-2 font-semibold text-[#101012]">Reintentar</button>}
        <button type="button" onClick={() => void signOut()} className="rounded-xl border border-[#3A3A40] px-4 py-2">Cerrar sesión</button>
      </main>
    );
  }
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
