import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Dumbbell, 
  BookOpen, 
  Calendar, 
  Download, 
  MessageSquare, 
  Sparkles, 
  HelpCircle,
  LogOut,
  Loader2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ClientData, Program } from '../../types';
import { supabase } from '../../lib/supabase';
import { TrainerDashboard } from './TrainerDashboard';
import { TrainerClientDetail } from './TrainerClientDetail';
import { TrainerPrograms } from './TrainerPrograms';
import { TrainerProgramNew } from './TrainerProgramNew';
import { TrainerProgramBuilder } from './TrainerProgramBuilder';
import { TrainerNutritionNew } from './TrainerNutritionNew';
import { TrainerNutritionBuilder } from './TrainerNutritionBuilder';
import { TrainerInvite } from './TrainerInvite';
import { TrainerExport } from './TrainerExport';
import { TrainerAssistant } from './TrainerAssistant';
import { TrainerGuide } from './TrainerGuide';
import { TrainerLogin } from './TrainerLogin';

type TrainerNavSection =
  | 'dashboard'
  | 'client_detail'
  | 'programs'
  | 'program_new'
  | 'program_builder'
  | 'nutrition_new'
  | 'nutrition_builder'
  | 'invite'
  | 'export'
  | 'assistant'
  | 'guide';

export const TrainerApp: React.FC = () => {
  const { 
    clients, 
    programs, 
    appName, 
    trainer, 
    updateTrainer, 
    supabaseUser, 
    userRole, 
    signOut, 
    supabaseStatus,
    isRealtimeActive,
    syncAllToSupabase
  } = useApp();

  // Authentication State
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticatedTrainer, setIsAuthenticatedTrainer] = useState(false);
  const [authDeniedMessage, setAuthDeniedMessage] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<TrainerNavSection>('dashboard');
  const [selectedClient, setSelectedClient] = useState<ClientData>(clients[0]);
  const [selectedProgram, setSelectedProgram] = useState<Program>(programs[0]);
  const [nutritionClientId, setNutritionClientId] = useState<string>(clients[0]?.id || 'cli-juan');
  const [isSyncing, setIsSyncing] = useState(false);

  // Trainer profile editing state
  const [showTrainerModal, setShowTrainerModal] = useState(false);
  const [trainerName, setTrainerName] = useState(trainer.name);
  const [trainerRole, setTrainerRole] = useState(trainer.role || 'Entrenador');
  const [trainerAvatar, setTrainerAvatar] = useState(trainer.avatarUrl || '');
  const trainerFileInputRef = React.useRef<HTMLInputElement>(null);

  // Verify Supabase session and role = 'trainer'
  useEffect(() => {
    let isMounted = true;

    const verifyTrainer = async (userId: string, userEmail?: string) => {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id, role, full_name, email, avatar_url')
          .eq('id', userId)
          .maybeSingle();

        if (error || !profile || profile.role !== 'trainer') {
          // If not trainer, sign out and show access denied
          await supabase.auth.signOut();
          if (isMounted) {
            setIsAuthenticatedTrainer(false);
            setAuthDeniedMessage('Acceso denegado: Esta cuenta no tiene permisos de entrenador.');
            setIsCheckingAuth(false);
          }
          return false;
        }

        if (isMounted) {
          const fullName = profile.full_name || userEmail?.split('@')[0] || 'Entrenador';
          const initials = fullName
            .split(' ')
            .filter(Boolean)
            .map((w: string) => w[0])
            .slice(0, 2)
            .join('')
            .toUpperCase() || 'TR';

          updateTrainer({
            id: profile.id,
            name: fullName,
            email: profile.email || userEmail || '',
            initials,
            role: 'Entrenador',
            avatarUrl: profile.avatar_url || '',
          });
          setTrainerName(fullName);
          setTrainerRole('Entrenador');
          setTrainerAvatar(profile.avatar_url || '');

          setIsAuthenticatedTrainer(true);
          setAuthDeniedMessage(null);
          setIsCheckingAuth(false);
        }
        return true;
      } catch {
        if (isMounted) {
          setIsAuthenticatedTrainer(false);
          setIsCheckingAuth(false);
        }
        return false;
      }
    };

    // 1. Initial check
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (!isMounted) return;
      if (error || !session?.user) {
        setIsAuthenticatedTrainer(false);
        setIsCheckingAuth(false);
        return;
      }
      await verifyTrainer(session.user.id, session.user.email);
    });

    // 2. Auth State Change Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT' || !session?.user) {
        setIsAuthenticatedTrainer(false);
        setIsCheckingAuth(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        await verifyTrainer(session.user.id, session.user.email);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await signOut();
    await supabase.auth.signOut();
    setIsAuthenticatedTrainer(false);
    setAuthDeniedMessage(null);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    await syncAllToSupabase();
    setIsSyncing(false);
  };

  const handleTrainerPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setTrainerAvatar(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveTrainerProfile = async () => {
    updateTrainer({
      name: trainerName,
      role: trainerRole,
      avatarUrl: trainerAvatar
    });
    if (trainer.id) {
      await supabase
        .from('profiles')
        .update({
          full_name: trainerName,
          avatar_url: trainerAvatar,
          updated_at: new Date().toISOString()
        })
        .eq('id', trainer.id);
    }
    setShowTrainerModal(false);
  };

  const handleSelectClient = (client: ClientData) => {
    setSelectedClient(client);
    setActiveSection('client_detail');
  };

  const handleEditProgram = (programId: string) => {
    const prog = programs.find(p => p.id === programId) || programs[0];
    setSelectedProgram(prog);
    setActiveSection('program_builder');
  };

  const handleEditNutrition = (clientId: string) => {
    setNutritionClientId(clientId);
    setActiveSection('nutrition_builder');
  };

  // Brief loading state while verifying session
  if (isCheckingAuth) {
    return (
      <div className="w-full min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center bg-[#101012] text-[#F5F4F0]">
        <div 
          className="w-12 h-12 rounded-2xl flex items-center justify-center p-2.5 shadow-lg mb-4 animate-pulse"
          style={{ backgroundColor: 'var(--accent-color, #CFFF5C)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#101012" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
            <path d="M4 17 L10 11 L14 15 L20 7" />
            <path d="M14 7 H20 V13" />
          </svg>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-[#8E8E94]">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-color,#CFFF5C)]" />
          <span>Verificando acceso de entrenador...</span>
        </div>
      </div>
    );
  }

  // Not authenticated as trainer -> Show TrainerLogin
  if (!isAuthenticatedTrainer) {
    return (
      <TrainerLogin
        initialError={authDeniedMessage}
        onLoginSuccess={() => {
          setIsAuthenticatedTrainer(true);
          setAuthDeniedMessage(null);
          setIsCheckingAuth(false);
        }}
      />
    );
  }

  return (
    <div className="flex w-full min-h-screen bg-[#101012] text-[#F5F4F0]">
      {/* Fixed Sidebar (240px) */}
      <aside className="w-60 shrink-0 bg-[#16161A] border-r border-[#2A2A2F] flex flex-col justify-between p-5 sticky top-0 h-screen select-none">
        <div>
          {/* Logo & Method tagline */}
          <div className="mb-8">
            <div className="flex items-center gap-2.5 mb-2">
              <div 
                className="w-8 h-8 rounded-xl flex items-center justify-center p-1.5 shadow-sm"
                style={{ backgroundColor: 'var(--accent-color, #CFFF5C)' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="#101012" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                  <path d="M4 17 L10 11 L14 15 L20 7" />
                  <path d="M14 7 H20 V13" />
                </svg>
              </div>
              <span className="font-extrabold font-display text-base tracking-wider text-[#F5F4F0]">
                {appName}
              </span>
            </div>
            <p className="text-[7.5px] tracking-widest text-[#8E8E94] font-bold uppercase leading-tight mb-3">
              PLANIFICACIÓN · ADHERENCIA · PROGRESIÓN
            </p>
            
            {/* Supabase Status Pill */}
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#1B1B1F] border border-[#2A2A2F] text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isRealtimeActive ? 'bg-[#CFFF5C] animate-pulse' : 'bg-[#FFD34D]'}`} />
                <span className="font-semibold text-[#F5F4F0]">Supabase Realtime</span>
              </div>
              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className="text-[9px] text-[var(--accent-color,#CFFF5C)] hover:underline cursor-pointer disabled:opacity-50"
                title="Sincronizar base de datos completa"
              >
                {isSyncing ? 'Sincronizando...' : 'Sync'}
              </button>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveSection('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                activeSection === 'dashboard' || activeSection === 'client_detail'
                  ? 'bg-[#1B1B1F] text-[#F5F4F0] border border-[#2A2A2F]'
                  : 'text-[#8E8E94] hover:text-[#F5F4F0] hover:bg-[#1B1B1F]/40'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Clientes</span>
            </button>

            <button
              onClick={() => setActiveSection('programs')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                activeSection === 'programs' || activeSection === 'program_new' || activeSection === 'program_builder'
                  ? 'bg-[#1B1B1F] text-[#F5F4F0] border border-[#2A2A2F]'
                  : 'text-[#8E8E94] hover:text-[#F5F4F0] hover:bg-[#1B1B1F]/40'
              }`}
            >
              <Dumbbell className="w-4 h-4" />
              <span>Programas</span>
            </button>

            <button
              onClick={() => setActiveSection('programs')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-[#8E8E94] hover:text-[#F5F4F0] hover:bg-[#1B1B1F]/40 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              <span>Biblioteca</span>
            </button>

            <button
              onClick={() => setActiveSection('dashboard')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-[#8E8E94] hover:text-[#F5F4F0] hover:bg-[#1B1B1F]/40 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              <span>Calendario</span>
            </button>

            <button
              onClick={() => setActiveSection('export')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                activeSection === 'export'
                  ? 'bg-[#1B1B1F] text-[#F5F4F0] border border-[#2A2A2F]'
                  : 'text-[#8E8E94] hover:text-[#F5F4F0] hover:bg-[#1B1B1F]/40'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Informes</span>
            </button>

            <button
              onClick={() => {
                setSelectedClient(clients[0]);
                setActiveSection('client_detail');
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-[#8E8E94] hover:text-[#F5F4F0] hover:bg-[#1B1B1F]/40 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Mensajes</span>
            </button>

            <button
              onClick={() => setActiveSection('assistant')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                activeSection === 'assistant'
                  ? 'bg-[#1B1B1F] text-[#F5F4F0] border border-[#2A2A2F]'
                  : 'text-[#8E8E94] hover:text-[#F5F4F0] hover:bg-[#1B1B1F]/40'
              }`}
            >
              <Sparkles className="w-4 h-4 text-[var(--accent-color,#CFFF5C)]" />
              <span>Asistente IA</span>
            </button>

            <button
              onClick={() => setActiveSection('guide')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                activeSection === 'guide'
                  ? 'bg-[#1B1B1F] text-[#F5F4F0] border border-[#2A2A2F]'
                  : 'text-[#8E8E94] hover:text-[#F5F4F0] hover:bg-[#1B1B1F]/40'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              <span>Ayuda</span>
            </button>
          </nav>
        </div>

        {/* Bottom Trainer Profile Pill with Edit Modal Trigger & Sign Out */}
        <div className="pt-4 border-t border-[#2A2A2F] flex flex-col gap-2">
          <div 
            onClick={() => {
              setTrainerName(trainer.name);
              setTrainerRole(trainer.role);
              setTrainerAvatar(trainer.avatarUrl || '');
              setShowTrainerModal(true);
            }}
            className="flex items-center justify-between cursor-pointer group hover:bg-[#1B1B1F]/50 p-2 rounded-xl transition-colors"
            title="Editar perfil y foto del entrenador"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="relative shrink-0">
                {trainer.avatarUrl ? (
                  <img
                    src={trainer.avatarUrl}
                    alt={trainer.name}
                    className="w-9 h-9 rounded-full object-cover border border-[#2A2A2F] group-hover:border-[var(--accent-color,#CFFF5C)] transition-colors"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center font-bold text-xs text-[#F5F4F0] group-hover:border-[var(--accent-color,#CFFF5C)] transition-colors">
                    {trainer.initials || 'TR'}
                  </div>
                )}
              </div>
              <div className="overflow-hidden">
                <span className="font-bold text-xs text-[#F5F4F0] block leading-tight group-hover:text-[var(--accent-color,#CFFF5C)] transition-colors truncate">
                  {trainer.name || 'Entrenador'}
                </span>
                <span className="text-[10px] text-[#8E8E94] truncate block">
                  {trainer.email || 'entrenador'}
                </span>
              </div>
            </div>
            <span className="text-[10px] text-[var(--accent-color,#CFFF5C)] opacity-0 group-hover:opacity-100 transition-opacity font-semibold shrink-0">
              Editar
            </span>
          </div>

          {/* Visible Cerrar sesión button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#FF6B4A] bg-[#FF6B4A]/10 border border-[#FF6B4A]/20 hover:bg-[#FF6B4A]/20 hover:border-[#FF6B4A]/30 transition-all cursor-pointer"
            title="Cerrar sesión de entrenador"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Trainer Profile & Photo Modal */}
      {showTrainerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-[400px] bg-[#16161A] border border-[#2A2A2F] rounded-[24px] p-6 shadow-2xl">
            <h3 className="text-lg font-bold font-display text-[#F5F4F0] mb-4">
              Perfil del Entrenador
            </h3>

            {/* Photo upload section */}
            <div className="flex flex-col items-center mb-5">
              <input
                type="file"
                accept="image/*"
                ref={trainerFileInputRef}
                onChange={handleTrainerPhotoUpload}
                className="hidden"
              />
              <div 
                onClick={() => trainerFileInputRef.current?.click()}
                className="relative cursor-pointer group"
              >
                {trainerAvatar ? (
                  <img
                    src={trainerAvatar}
                    alt={trainerName}
                    className="w-20 h-20 rounded-full object-cover border-2 border-[var(--accent-color,#CFFF5C)] shadow-md"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center font-display font-extrabold text-xl text-[#F5F4F0] group-hover:border-[var(--accent-color,#CFFF5C)] transition-colors">
                    {trainer.initials}
                  </div>
                )}
                <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[var(--accent-color,#CFFF5C)] text-[#101012] flex items-center justify-center shadow-md">
                  <Sparkles className="w-3.5 h-3.5 fill-current" />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => trainerFileInputRef.current?.click()}
                  className="text-xs font-bold text-[var(--accent-color,#CFFF5C)] hover:underline"
                >
                  {trainerAvatar ? 'Cambiar foto' : 'Subir foto'}
                </button>
                {trainerAvatar && (
                  <button
                    type="button"
                    onClick={() => setTrainerAvatar('')}
                    className="text-xs text-[#8E8E94] hover:text-red-400"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>

            {/* Fields */}
            <div className="space-y-3 mb-6">
              <div>
                <label className="text-[10px] font-bold text-[#8E8E94] uppercase tracking-wider block mb-1">
                  Nombre del Entrenador
                </label>
                <input
                  type="text"
                  value={trainerName}
                  onChange={e => setTrainerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-[#8E8E94] uppercase tracking-wider block mb-1">
                  Título / Rol
                </label>
                <input
                  type="text"
                  value={trainerRole}
                  onChange={e => setTrainerRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
                />
              </div>

              {/* Supabase account card */}
              <div className="p-3 rounded-xl bg-[#101012] border border-[#2A2A2F]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-[#8E8E94] uppercase tracking-wider">
                    Cuenta Supabase
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#1B1B1F] text-[#CFFF5C] font-semibold border border-[#2A2A2F]">
                    {userRole || 'Entrenador'}
                  </span>
                </div>
                <div className="text-xs text-[#F5F4F0] truncate font-mono">
                  {supabaseUser?.email || trainer.email}
                </div>
                {supabaseUser && (
                  <button
                    type="button"
                    onClick={async () => {
                      await signOut();
                      setShowTrainerModal(false);
                    }}
                    className="mt-2 text-xs text-[#FF6B4A] hover:underline font-semibold cursor-pointer block"
                  >
                    Cerrar sesión de Supabase
                  </button>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowTrainerModal(false)}
                className="flex-1 py-2.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#8E8E94] hover:text-[#F5F4F0]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveTrainerProfile}
                style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                className="flex-1 py-2.5 rounded-full font-bold text-xs shadow-md transition-transform active:scale-95"
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {activeSection === 'dashboard' && (
          <TrainerDashboard
            onSelectClient={handleSelectClient}
            onOpenInvite={() => setActiveSection('invite')}
          />
        )}

        {activeSection === 'client_detail' && (
          <TrainerClientDetail
            client={selectedClient}
            onBack={() => setActiveSection('dashboard')}
            onEditProgram={handleEditProgram}
            onEditNutrition={handleEditNutrition}
          />
        )}

        {activeSection === 'programs' && (
          <TrainerPrograms
            onSelectProgram={(prog) => {
              setSelectedProgram(prog);
              setActiveSection('program_builder');
            }}
            onCreateNewProgram={() => setActiveSection('program_new')}
          />
        )}

        {activeSection === 'program_new' && (
          <TrainerProgramNew
            onBack={() => setActiveSection('programs')}
            onProceedToBuilder={(cfg) => {
              setSelectedProgram({
                id: `prog-${Date.now()}`,
                name: cfg.name,
                type: cfg.objective,
                durationWeeks: cfg.durationWeeks,
                daysPerWeek: cfg.daysPerWeek,
                level: cfg.level,
                autoGenerated: true,
                assignedClientsCount: 0,
                weeksVolume: [
                  { week: 1, volume: 80, deload: false },
                  { week: 2, volume: 85, deload: false },
                  { week: 3, volume: 90, deload: false },
                  { week: 4, volume: 55, deload: true },
                  { week: 5, volume: 92, deload: false },
                  { week: 6, volume: 96, deload: false },
                  { week: 7, volume: 100, deload: false },
                  { week: 8, volume: 60, deload: true },
                ] as any,
                days: []
              });
              setActiveSection('program_builder');
            }}
          />
        )}

        {activeSection === 'program_builder' && (
          <TrainerProgramBuilder
            program={selectedProgram}
            onBack={() => setActiveSection('programs')}
            onSave={() => setActiveSection('programs')}
          />
        )}

        {activeSection === 'nutrition_new' && (
          <TrainerNutritionNew
            clientId={nutritionClientId}
            onBack={() => setActiveSection('client_detail')}
            onProceedToBuilder={() => setActiveSection('nutrition_builder')}
          />
        )}

        {activeSection === 'nutrition_builder' && (
          <TrainerNutritionBuilder
            clientId={nutritionClientId}
            onBack={() => setActiveSection('client_detail')}
            onSave={() => setActiveSection('client_detail')}
          />
        )}

        {activeSection === 'invite' && (
          <TrainerInvite
            onBack={() => setActiveSection('dashboard')}
            onSuccess={() => setActiveSection('dashboard')}
          />
        )}

        {activeSection === 'export' && (
          <TrainerExport />
        )}

        {activeSection === 'assistant' && (
          <TrainerAssistant />
        )}

        {activeSection === 'guide' && (
          <TrainerGuide onNavigate={(sec) => setActiveSection(sec as TrainerNavSection)} />
        )}
      </main>
    </div>
  );
};
