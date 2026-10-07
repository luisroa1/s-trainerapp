import React, { useState } from 'react';
import { 
  Users, 
  Dumbbell, 
  BookOpen, 
  Calendar, 
  Download, 
  MessageSquare, 
  Sparkles, 
  HelpCircle, 
  LogOut 
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ClientData, Program } from '../../types';
import { supabase } from '../../lib/supabase';
import { TrainerDashboard } from './TrainerDashboard';
import { TrainerClientDetail } from './TrainerClientDetail';
import { TrainerPrograms } from './TrainerPrograms';
import { TrainerProgramNew } from './TrainerProgramNew';
import { TrainerProgramBuilder } from './TrainerProgramBuilder';
import { TrainerNutritionBuilder } from './TrainerNutritionBuilder';
import { TrainerInvite } from './TrainerInvite';
import { TrainerExport } from './TrainerExport';
import { TrainerAssistant } from './TrainerAssistant';
import { TrainerGuide } from './TrainerGuide';

type TrainerNavSection =
  | 'dashboard'
  | 'client_detail'
  | 'programs'
  | 'program_new'
  | 'program_builder'
  | 'nutrition_builder'
  | 'invite'
  | 'export'
  | 'assistant'
  | 'guide';

export const TrainerApp: React.FC = () => {
  const { 
    clients, 
    programs, 
    setActiveClientId,
    appName, 
    trainer, 
    updateTrainer, 
    supabaseUser, 
    userRole, 
    isAdmin,
    signOut, 
    supabaseStatus,
    isRealtimeActive
  } = useApp();

  // Navigation & Data State
  const [activeSection, setActiveSection] = useState<TrainerNavSection>('dashboard');
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [nutritionClientId, setNutritionClientId] = useState<string>('');

  // Trainer profile editing state
  const [showTrainerModal, setShowTrainerModal] = useState(false);
  const [trainerName, setTrainerName] = useState(trainer.name);
  const [trainerRole, setTrainerRole] = useState(trainer.role || 'Entrenador');
  const [trainerAvatar, setTrainerAvatar] = useState(trainer.avatarUrl || '');
  const trainerFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleLogout = async () => {
    await signOut();
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
    setActiveClientId(client.id);
    setActiveSection('client_detail');
  };

  const handleEditProgram = (programId: string) => {
    const prog = programs.find(p => p.id === programId) || null;
    setSelectedProgram(prog);
    setActiveSection('program_builder');
  };

  const handleEditNutrition = (clientId: string) => {
    setNutritionClientId(clientId);
    setActiveSection('nutrition_builder');
  };

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
              PLANIFICACIÓN · EJECUCIÓN · HISTORIAL
            </p>
            
            {/* Supabase Status Pill */}
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#1B1B1F] border border-[#2A2A2F] text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isRealtimeActive ? 'bg-[#CFFF5C] animate-pulse' : 'bg-[#FFD34D]'}`} />
                <span className="font-semibold text-[#F5F4F0]">Supabase Realtime</span>
              </div>
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
                if (clients.length > 0) {
                  setSelectedClient(clients[0]);
                  setActiveSection('client_detail');
                } else {
                  setActiveSection('dashboard');
                }
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
              <span>Asistente</span>
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
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-[#F5F4F0] block leading-tight group-hover:text-[var(--accent-color,#CFFF5C)] transition-colors truncate">
                    {trainer.name || 'Entrenador'}
                  </span>
                  {isAdmin && (
                    <span className="px-1.5 py-0.5 rounded-md bg-[#FFD34D]/20 text-[#FFD34D] border border-[#FFD34D]/40 text-[8px] font-extrabold uppercase tracking-wider shrink-0">
                      Admin
                    </span>
                  )}
                </div>
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
        {/* Header Bar with Trainer Name/Avatar and Admin Badge */}
        <header className="h-14 border-b border-[#2A2A2F] bg-[#16161A]/80 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              {trainer.avatarUrl ? (
                <img
                  src={trainer.avatarUrl}
                  alt={trainer.name}
                  className="w-8 h-8 rounded-full object-cover border border-[#2A2A2F]"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center font-bold text-xs text-[#F5F4F0]">
                  {trainer.initials || 'TR'}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-xs text-[#F5F4F0]">
                {trainer.name || 'Entrenador'}
              </span>
              {isAdmin && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#FFD34D]/20 text-[#FFD34D] border border-[#FFD34D]/40 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FFD34D] animate-pulse" />
                  <span>Modo Administrador</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-[#8E8E94]">
            <span className="font-mono text-[11px] hidden sm:inline">{trainer.email}</span>
          </div>
        </header>

        {activeSection === 'dashboard' && (
          <TrainerDashboard
            onSelectClient={handleSelectClient}
            onOpenInvite={() => setActiveSection('invite')}
          />
        )}

        {activeSection === 'client_detail' && (
          selectedClient ? (
            <TrainerClientDetail
              client={selectedClient}
              onBack={() => setActiveSection('dashboard')}
              onEditProgram={handleEditProgram}
              onEditNutrition={handleEditNutrition}
            />
          ) : (
            <div className="p-8 max-w-[1240px] mx-auto text-center py-20">
              <p className="text-sm text-[#8E8E94]">Ningún cliente seleccionado.</p>
              <button
                onClick={() => setActiveSection('dashboard')}
                className="mt-4 px-4 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#F5F4F0] cursor-pointer"
              >
                Volver a la lista de clientes
              </button>
            </div>
          )
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
                id: globalThis.crypto.randomUUID(),
                name: cfg.name,
                type: cfg.objective,
                durationWeeks: cfg.durationWeeks,
                daysPerWeek: cfg.daysPerWeek,
                level: cfg.level,
                autoGenerated: false,
                assignedClientsCount: 0,
                weeksVolume: [],
                days: []
              });
              setActiveSection('program_builder');
            }}
          />
        )}

        {activeSection === 'program_builder' && (
          selectedProgram ? (
            <TrainerProgramBuilder
              program={selectedProgram}
              onBack={() => setActiveSection('programs')}
              onSave={() => setActiveSection('programs')}
            />
          ) : (
            <div className="p-8 max-w-[1240px] mx-auto text-center py-20">
              <p className="text-sm text-[#8E8E94]">Ningún programa seleccionado para editar.</p>
              <button
                onClick={() => setActiveSection('programs')}
                className="mt-4 px-4 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#F5F4F0] cursor-pointer"
              >
                Volver a la lista de programas
              </button>
            </div>
          )
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
