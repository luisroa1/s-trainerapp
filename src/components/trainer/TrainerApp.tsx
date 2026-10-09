import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ClientData, Program } from '../../types';
import { supabase, IS_READ_ONLY_PREVIEW } from '../../lib/supabase';
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
import { TrainerBrandMark, TrainerIcon } from '../common/TrainerVisualSystem';

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
    refreshFromSupabase,
    programs, 
    setActiveClientId,
    trainer, 
    updateTrainer, 
    supabaseUser, 
    userRole, 
    signOut
  } = useApp();

  // Navigation & Data State
  const [activeSection, setActiveSection] = useState<TrainerNavSection>('dashboard');
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [workstationTab, setWorkstationTab] = useState<'Entrenamiento' | 'Nutrición' | 'Progreso' | 'Seguimiento' | 'Informes'>('Entrenamiento');
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [nutritionClientId, setNutritionClientId] = useState<string>('');

  // Trainer profile editing state
  const [showTrainerModal, setShowTrainerModal] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
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
    if (IS_READ_ONLY_PREVIEW) return;
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
    if (selectedClient?.id !== client.id) setWorkstationTab('Entrenamiento');
    setSelectedClient(client);
    setActiveClientId(client.id);
    setActiveSection('client_detail');
  };

  const handleEditNutrition = (clientId: string) => {
    setNutritionClientId(clientId);
    setActiveSection('nutrition_builder');
  };

  const isClientWorkstation = activeSection === 'client_detail' && selectedClient !== null;
  const trainerInitials = trainer.initials?.trim() || trainer.name?.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '';

  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [accountMenuOpen]);

  return (
    <div className="trainer-app min-h-screen w-full">
      {isClientWorkstation ? (
        <main className="min-h-screen min-w-0 overflow-x-clip">
          {IS_READ_ONLY_PREVIEW && <div role="status" className="trainer-readonly-banner">Vista previa de solo lectura</div>}
          <TrainerClientDetail
            client={selectedClient!}
            onBack={() => setActiveSection('dashboard')}
            trainer={trainer}
            onSignOut={handleLogout}
            activeTab={workstationTab}
            onTabChange={setWorkstationTab}
            onEditNutrition={handleEditNutrition}
            onOpenReports={() => setActiveSection('export')}
          />
        </main>
      ) : (
        <>
          <header className="trainer-global-header">
            <div className="trainer-header-brand"><TrainerBrandMark /></div>
            <div className="trainer-header-account">
              <span className="trainer-notification-mark" aria-hidden="true">
                <TrainerIcon name="notification" size={34} />
              </span>
              <div className="trainer-account-control">
                <button
                  type="button"
                  className="trainer-account-trigger"
                  aria-label="Abrir menú de cuenta"
                  aria-expanded={accountMenuOpen}
                  aria-haspopup="true"
                  onClick={() => setAccountMenuOpen(open => !open)}
                >
                  {trainer.avatarUrl ? <img src={trainer.avatarUrl} alt="" /> : <span>{trainerInitials}</span>}
                </button>
                <button
                  type="button"
                  className="trainer-account-chevron"
                  aria-label={accountMenuOpen ? 'Cerrar menú de cuenta' : 'Abrir menú de cuenta'}
                  aria-expanded={accountMenuOpen}
                  onClick={() => setAccountMenuOpen(open => !open)}
                ><TrainerIcon name="chevronDown" size={22} /></button>
                {accountMenuOpen && (
                  <div className="trainer-account-menu" aria-label="Menú de cuenta">
                    <div className="trainer-account-menu-identity">
                      <strong>{trainer.name || 'Perfil del entrenador'}</strong>
                      {trainer.email && <span>{trainer.email}</span>}
                    </div>
                    {!IS_READ_ONLY_PREVIEW && <button type="button" onClick={() => {
                      setTrainerName(trainer.name);
                      setTrainerRole(trainer.role || 'Entrenador');
                      setTrainerAvatar(trainer.avatarUrl || '');
                      setShowTrainerModal(true);
                      setAccountMenuOpen(false);
                    }}>Perfil del entrenador</button>}
                    <button type="button" onClick={handleLogout}>Cerrar sesión</button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="trainer-global-layout">
            <aside className="trainer-global-sidebar" aria-label="Navegación principal del entrenador">
              <div className="trainer-sidebar-top">
                <p className="trainer-sidebar-label">ESPACIO TRAINER</p>
                <nav className="trainer-global-nav">
                  <button type="button" aria-current={activeSection === 'dashboard' ? 'page' : undefined} onClick={() => setActiveSection('dashboard')} className={activeSection === 'dashboard' || activeSection === 'client_detail' ? 'active' : ''}>
                    <TrainerIcon name="clients" size={33} /><span>Clientes</span>
                  </button>
                  <button type="button" aria-current={['programs', 'program_new', 'program_builder'].includes(activeSection) ? 'page' : undefined} onClick={() => setActiveSection('programs')} className={['programs', 'program_new', 'program_builder'].includes(activeSection) ? 'active' : ''}>
                    <TrainerIcon name="programs" size={32} /><span>Programas</span>
                  </button>
                  <button type="button" className="unavailable" disabled aria-disabled="true" title="Biblioteca no disponible">
                    <TrainerIcon name="library" size={32} /><span>Biblioteca</span>
                  </button>
                  <button type="button" className="unavailable" disabled aria-disabled="true" title="Agenda no disponible">
                    <TrainerIcon name="agenda" size={32} /><span>Agenda</span>
                  </button>
                </nav>
              </div>
              <div className="trainer-sidebar-bottom">
                <button type="button" className={activeSection === 'guide' ? 'trainer-help-link active' : 'trainer-help-link'} onClick={() => setActiveSection('guide')}>
                  <TrainerIcon name="help" size={32} /><span>Ayuda</span>
                </button>
                <div className="trainer-sidebar-profile" aria-label="Cuenta del entrenador">
                  {trainer.avatarUrl ? <img src={trainer.avatarUrl} alt="" /> : <span className="trainer-sidebar-initials">{trainerInitials}</span>}
                  <span className="trainer-sidebar-profile-copy"><strong>{trainer.name || 'Perfil del entrenador'}</strong><small>{trainer.role || 'Entrenador'}</small></span>
                </div>
              </div>
            </aside>

            <main className="trainer-global-main">
              {IS_READ_ONLY_PREVIEW && <div role="status" className="trainer-readonly-banner">Vista previa de solo lectura</div>}
              {activeSection === 'dashboard' && (
                <TrainerDashboard
                  trainer={trainer}
                  onSelectClient={handleSelectClient}
                  onOpenInvite={() => setActiveSection('invite')}
                  onOpenPrograms={() => setActiveSection('programs')}
                  onRetry={() => void refreshFromSupabase(supabaseUser?.id, userRole)}
                />
              )}
              {activeSection === 'programs' && <TrainerPrograms onSelectProgram={prog => { setSelectedProgram(prog); setActiveSection('program_builder'); }} onCreateNewProgram={() => setActiveSection('program_new')} />}
              {activeSection === 'program_new' && <TrainerProgramNew onBack={() => setActiveSection('programs')} onProceedToBuilder={cfg => {
                setSelectedProgram({ id: globalThis.crypto.randomUUID(), name: cfg.name, type: cfg.objective, durationWeeks: cfg.durationWeeks, daysPerWeek: cfg.daysPerWeek, level: cfg.level, autoGenerated: false, assignedClientsCount: 0, weeksVolume: [], days: [] });
                setActiveSection('program_builder');
              }} />}
              {activeSection === 'program_builder' && (selectedProgram ? <TrainerProgramBuilder program={selectedProgram} onBack={() => setActiveSection('programs')} onSave={() => setActiveSection('programs')} /> : <div className="trainer-route-empty">Ningún programa seleccionado para editar.</div>)}
              {activeSection === 'nutrition_builder' && <TrainerNutritionBuilder clientId={nutritionClientId} onBack={() => setActiveSection(selectedClient ? 'client_detail' : 'dashboard')} onSave={() => setActiveSection(selectedClient ? 'client_detail' : 'dashboard')} />}
              {activeSection === 'invite' && <TrainerInvite readOnly={IS_READ_ONLY_PREVIEW} onBack={() => setActiveSection('dashboard')} onSuccess={() => setActiveSection('dashboard')} />}
              {activeSection === 'export' && <TrainerExport />}
              {activeSection === 'assistant' && <TrainerAssistant />}
              {activeSection === 'guide' && <TrainerGuide onNavigate={sec => setActiveSection(sec as TrainerNavSection)} />}
            </main>
          </div>
          {showTrainerModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
              <div className="w-full max-w-[400px] bg-[#16161A] border border-[#2A2A2F] rounded-[24px] p-6 shadow-2xl">
                <h3 className="text-lg font-bold font-display text-[#F5F4F0] mb-4">Perfil del Entrenador</h3>
                <div className="flex flex-col items-center mb-5">
                  <input type="file" accept="image/*" ref={trainerFileInputRef} onChange={handleTrainerPhotoUpload} className="hidden" />
                  <button type="button" onClick={() => trainerFileInputRef.current?.click()} className="relative cursor-pointer group" aria-label="Cambiar foto del entrenador">
                    {trainerAvatar ? <img src={trainerAvatar} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-[var(--trainer-cyan)]" /> : <span className="w-20 h-20 rounded-full border border-[var(--trainer-border)] inline-flex items-center justify-center">{trainerInitials}</span>}
                    <span className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[var(--trainer-cyan)] text-[#07141A] flex items-center justify-center"><Sparkles className="w-3.5 h-3.5" /></span>
                  </button>
                  <div className="flex items-center gap-3 mt-2">
                    <button type="button" onClick={() => trainerFileInputRef.current?.click()} className="text-xs font-bold text-[var(--trainer-cyan)]">{trainerAvatar ? 'Cambiar foto' : 'Subir foto'}</button>
                    {trainerAvatar && <button type="button" onClick={() => setTrainerAvatar('')} className="text-xs text-[var(--trainer-muted)]">Eliminar</button>}
                  </div>
                </div>
                <div className="space-y-3 mb-6">
                  <label className="block text-xs text-[var(--trainer-muted)]">Nombre del entrenador<input type="text" value={trainerName} onChange={e => setTrainerName(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl bg-[var(--trainer-bg)] border border-[var(--trainer-border)] text-[var(--trainer-text)]" /></label>
                  <label className="block text-xs text-[var(--trainer-muted)]">Título / Rol<input type="text" value={trainerRole} onChange={e => setTrainerRole(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl bg-[var(--trainer-bg)] border border-[var(--trainer-border)] text-[var(--trainer-text)]" /></label>
                  <div className="rounded-xl border border-[var(--trainer-border)] p-3 text-xs"><div className="flex justify-between"><span>Cuenta</span><span>{userRole || 'Entrenador'}</span></div><div className="mt-1">{supabaseUser?.email || trainer.email}</div></div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowTrainerModal(false)} className="trainer-button trainer-button-secondary flex-1">Cancelar</button>
                  <button type="button" onClick={handleSaveTrainerProfile} className="trainer-button trainer-button-primary flex-1">Guardar cambios</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
