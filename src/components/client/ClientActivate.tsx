import React, { useState, useEffect } from 'react';
import { BrandLogo } from '../common/BrandLogo';
import { 
  Lock, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  ArrowRight,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { supabase, supabaseDb } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import { clearSuccessfulActivationFlow } from '../../lib/activationUrl.mjs';

interface ClientActivateProps {
  onFinishActivation: () => void;
  onGoToLogin?: () => void;
}

export const ClientActivate: React.FC<ClientActivateProps> = ({ 
  onFinishActivation,
  onGoToLogin 
}) => {
  const { appName, supabaseUser, activeClient, updateClient, refreshFromSupabase } = useApp();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resolvedEmail, setResolvedEmail] = useState<string>('');
  const [isVerifyingSession, setIsVerifyingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const rawHash = window.location.hash;
        let cleanHash = rawHash.startsWith('#') ? rawHash.substring(1) : rawHash;
        if (cleanHash.includes('access_token=')) {
          cleanHash = cleanHash.substring(cleanHash.indexOf('access_token='));
        } else if (cleanHash.includes('?')) {
          cleanHash = cleanHash.substring(cleanHash.indexOf('?') + 1);
        }

        const params = new URLSearchParams(cleanHash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken) {
          // 1. Prioridad total: Extraer tokens del hash e inicializar la sesión explícita
          const { data: setData, error: setError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (setError || !setData?.session?.user?.email) {
            console.warn('Error al establecer sesión desde hash de invitación:', setError);
            if (isMounted) {
              setResolvedEmail('');
              setErrorMessage('El enlace de activación no es válido o ha caducado. Solicita una nueva invitación.');
            }
            return;
          }

          if (isMounted) {
            setResolvedEmail(setData.session.user.email);
            setErrorMessage(null);
          }
        } else {
          // 2. Solo si NO hay access_token en el hash (ej. recarga tras procesar), usar sesión como respaldo
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) {
            console.warn('Error obteniendo sesión de activación:', sessionError);
          }

          if (session?.user?.email && isMounted) {
            setResolvedEmail(session.user.email);
            setErrorMessage(null);
          } else if (isMounted) {
            setResolvedEmail('');
            setErrorMessage('El enlace de activación no es válido o ha caducado. Solicita una nueva invitación.');
          }
        }
      } catch (err) {
        console.error('Error verificando sesión de activación:', err);
        if (isMounted) {
          setResolvedEmail('');
          setErrorMessage('El enlace de activación no es válido o ha caducado. Solicita una nueva invitación.');
        }
      } finally {
        if (isMounted) setIsVerifyingSession(false);
      }
    }

    checkSession();

    // Escuchar si Supabase procesa el hash del invite solo cuando no hay token explícito en el hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!window.location.hash.includes('access_token') && session?.user?.email && isMounted) {
        setResolvedEmail(session.user.email);
        setIsVerifyingSession(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!resolvedEmail) {
      setErrorMessage('El enlace de activación no es válido o ha caducado. Solicita una nueva invitación.');
      return;
    }

    if (!password) {
      setErrorMessage('Por favor introduce tu nueva contraseña.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Actualizar contraseña del usuario en Supabase Auth
      const { data, error } = await supabase.auth.updateUser({
        password: password,
        data: {
          status: 'Activo',
        },
      });

      if (error) {
        setIsLoading(false);
        setErrorMessage(error.message || 'Error al fijar la contraseña en Supabase.');
        return;
      }

      const userEmail = data.user?.email || resolvedEmail;

      // 2. Activar cliente vía Edge Function 'activate-client' (vía principal con service_role)
      let activatedViaEdgeFunction = false;
      try {
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('activate-client', {
          body: {},
        });

        if (!edgeError && edgeData?.success) {
          activatedViaEdgeFunction = true;
          console.log('Cliente activado con éxito vía Edge Function activate-client:', edgeData);
          if (edgeData.client?.id) {
            updateClient(edgeData.client.id, { status: 'Activo' });
          }
        } else if (edgeError) {
          console.warn('Edge Function activate-client reportó advertencia, intentando respaldo directo:', edgeError);
        }
      } catch (funcErr) {
        console.warn('Excepción al invocar activate-client, intentando respaldo directo:', funcErr);
      }

      // Respaldo best-effort directo en tabla clients si la Edge Function no estuviera disponible
      if (!activatedViaEdgeFunction && userEmail) {
        try {
          await supabase
            .from('clients')
            .update({
              status: 'Activo',
              user_id: data.user?.id,
              updated_at: new Date().toISOString(),
            })
            .ilike('email', userEmail);
        } catch (dbErr) {
          console.warn('Advertencia actualizando estado en tabla clients (respaldo directo):', dbErr);
        }

        // Si tenemos un cliente activo en contexto, actualizarlo
        if (activeClient && activeClient.email.toLowerCase() === userEmail.toLowerCase()) {
          updateClient(activeClient.id, { status: 'Activo' });
        }
      } else if (activeClient && userEmail && activeClient.email.toLowerCase() === userEmail.toLowerCase()) {
        updateClient(activeClient.id, { status: 'Activo' });
      }

      window.history.replaceState(
        null,
        '',
        clearSuccessfulActivationFlow(window.location.href),
      );

      setSuccessMessage('¡Contraseña establecida con éxito! Tu cuenta está activa.');
      setIsLoading(false);

      // Recargar datos y entrar a la app
      setTimeout(async () => {
        await refreshFromSupabase();
        onFinishActivation();
      }, 1000);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Error inesperado al activar la cuenta.');
    }
  };

  return (
    <div className="min-h-full flex flex-col justify-between items-center px-6 py-10 bg-[#101012] text-[#F5F4F0] overflow-y-auto">
      {/* Header / Brand */}
      <div className="w-full flex flex-col items-center text-center">
        <BrandLogo size="lg" showSubtitle={false} />
        
        <div className="mt-6 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-[10px] text-[var(--accent-color,#CFFF5C)]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Activación de cuenta oficial</span>
        </div>

        <h2 className="text-2xl font-extrabold font-display text-[#F5F4F0] mt-4 leading-tight">
          Activa tu cuenta
        </h2>
        <p className="text-xs text-[#8E8E94] mt-1.5 max-w-[280px] leading-relaxed">
          Crea tu contraseña para acceder a tu plan de entrenamiento y nutrición en {appName}.
        </p>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-[340px] my-6">
        {/* Identified Email badge */}
        {resolvedEmail && (
          <div className="p-3.5 rounded-[14px] bg-[#16161A] border border-[#2A2A2F] mb-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[var(--accent-color,#CFFF5C)] shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <span className="text-[10px] uppercase font-bold text-[#8E8E94] tracking-wider block">
                Cuenta a activar
              </span>
              <span className="text-xs font-bold text-[#F5F4F0] truncate block">
                {resolvedEmail}
              </span>
            </div>
          </div>
        )}

        {/* Feedback alerts */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/30 flex items-start gap-2.5 text-green-400 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-snug">{successMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
              NUEVA CONTRASEÑA
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
              CONFIRMAR CONTRASEÑA
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading || isVerifyingSession || !resolvedEmail}
              style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
              className="w-full py-3.5 rounded-full font-bold text-xs shadow-lg transition-transform active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Activando en Supabase...</span>
                </>
              ) : (
                <>
                  <span>Fijar contraseña y entrar</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Footer / Login fallback */}
      <div className="w-full text-center pt-4">
        {onGoToLogin && (
          <button
            type="button"
            onClick={onGoToLogin}
            className="text-xs text-[#8E8E94] hover:text-[#F5F4F0] transition-colors cursor-pointer"
          >
            ¿Ya tienes tu clave? <span className="text-[var(--accent-color,#CFFF5C)] underline font-semibold">Iniciar sesión</span>
          </button>
        )}
      </div>
    </div>
  );
};
