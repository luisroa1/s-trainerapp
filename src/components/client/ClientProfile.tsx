import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  User, 
  Ruler, 
  Camera, 
  Moon, 
  Activity, 
  Droplet, 
  Pill, 
  Bell, 
  HelpCircle, 
  ChevronRight 
} from 'lucide-react';

interface ClientProfileProps {
  onNavigateSubscreen: (subscreen: 'datos' | 'medidas' | 'fotos' | 'ciclo' | 'recordatorios' | 'suplementos' | 'guia') => void;
  onLogout: () => void;
}

export const ClientProfile: React.FC<ClientProfileProps> = ({
  onNavigateSubscreen,
  onLogout
}) => {
  const { activeClient, updateClientPhoto, supabaseUser, userRole, signOut, supabaseStatus } = useApp();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleLogout = async () => {
    await signOut();
    onLogout();
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          updateClientPhoto(activeClient.id, event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-20 px-5 pt-6 bg-[#101012] text-[#F5F4F0]">
      {/* Hidden file input */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handlePhotoUpload}
        className="hidden"
      />

      {/* Header Avatar & Name */}
      <div className="flex items-center gap-4 mb-6">
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="relative cursor-pointer group"
          title="Toca para cambiar foto"
        >
          {activeClient.avatarUrl ? (
            <img
              src={activeClient.avatarUrl}
              alt={activeClient.name}
              className="w-14 h-14 rounded-full object-cover border-2 border-[var(--accent-color,#CFFF5C)] shadow-md"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center font-display font-extrabold text-base text-[#F5F4F0] shadow-md group-hover:border-[var(--accent-color,#CFFF5C)] transition-colors">
              {activeClient.initials}
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[var(--accent-color,#CFFF5C)] text-[#101012] flex items-center justify-center shadow-md">
            <Camera className="w-3 h-3" />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-bold font-display text-[#F5F4F0] leading-tight">
            {activeClient.name}
          </h2>
          <p className="text-xs text-[#8E8E94] mt-0.5">
            {activeClient.objective}
          </p>
          {supabaseUser && (
            <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-[#CFFF5C]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#CFFF5C] animate-pulse" />
              <span className="truncate max-w-[170px]">{supabaseUser.email}</span>
              <span className="px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider bg-[#1B1B1F] border border-[#2A2A2F] text-[#F5F4F0]">
                {userRole || 'cliente'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Menu List */}
      <div className="space-y-2">
        {/* Datos personales */}
        <div
          onClick={() => onNavigateSubscreen('datos')}
          className="p-3.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between cursor-pointer hover:border-[#3A3A40] transition-colors"
        >
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-[#8E8E94]" />
            <span className="text-xs font-semibold text-[#F5F4F0]">Datos personales</span>
          </div>
          <ChevronRight className="w-4 h-4 text-[#5C5C62]" />
        </div>

        {/* Medidas corporales */}
        <div
          onClick={() => onNavigateSubscreen('medidas')}
          className="p-3.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between cursor-pointer hover:border-[#3A3A40] transition-colors"
        >
          <div className="flex items-center gap-3">
            <Ruler className="w-4 h-4 text-[#8E8E94]" />
            <span className="text-xs font-semibold text-[#F5F4F0]">Medidas corporales</span>
          </div>
          <ChevronRight className="w-4 h-4 text-[#5C5C62]" />
        </div>

        {/* Fotos e impedanciometría */}
        <div
          onClick={() => onNavigateSubscreen('fotos')}
          className="p-3.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between cursor-pointer hover:border-[#3A3A40] transition-colors"
        >
          <div className="flex items-center gap-3">
            <Camera className="w-4 h-4 text-[#8E8E94]" />
            <span className="text-xs font-semibold text-[#F5F4F0]">Fotos e impedanciometría</span>
          </div>
          <ChevronRight className="w-4 h-4 text-[#5C5C62]" />
        </div>

        {/* Ciclo menstrual */}
        <div
          onClick={() => onNavigateSubscreen('ciclo')}
          className="p-3.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between cursor-pointer hover:border-[#3A3A40] transition-colors"
        >
          <div className="flex items-center gap-3">
            <Moon className="w-4 h-4 text-[#E8A0C4]" />
            <span className="text-xs font-semibold text-[#F5F4F0]">Ciclo menstrual</span>
          </div>
          <div className="flex items-center gap-2">
            {activeClient.menstrualTracking?.enabled && (
              <span className="text-[10px] text-[#E8A0C4] bg-[#E8A0C4]/15 px-2 py-0.5 rounded-full font-bold">
                Día {activeClient.menstrualTracking.day}
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-[#5C5C62]" />
          </div>
        </div>

        {/* Dispositivos conectados: Apple Health */}
        <div className="p-3.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-4 h-4 text-[#5CD6FF]" />
            <span className="text-xs font-semibold text-[#F5F4F0]">Dispositivos conectados</span>
          </div>
          <span className="text-[10px] font-bold text-[#CFFF5C] bg-[#CFFF5C]/15 px-2.5 py-0.5 rounded-full border border-[#CFFF5C]/20">
            Apple Health
          </span>
        </div>

        {/* Recordatorios */}
        <div
          onClick={() => onNavigateSubscreen('recordatorios')}
          className="p-3.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between cursor-pointer hover:border-[#3A3A40] transition-colors"
        >
          <div className="flex items-center gap-3">
            <Droplet className="w-4 h-4 text-[#8E8E94]" />
            <div>
              <span className="text-xs font-semibold text-[#F5F4F0] block">Recordatorios</span>
              <span className="text-[9.5px] text-[#8E8E94]">Hidratación · Descanso · Sueño</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#5C5C62]" />
        </div>

        {/* Suplementación */}
        <div
          onClick={() => onNavigateSubscreen('suplementos')}
          className="p-3.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between cursor-pointer hover:border-[#3A3A40] transition-colors"
        >
          <div className="flex items-center gap-3">
            <Pill className="w-4 h-4 text-[#8E8E94]" />
            <span className="text-xs font-semibold text-[#F5F4F0]">Suplementación</span>
          </div>
          <ChevronRight className="w-4 h-4 text-[#5C5C62]" />
        </div>

        {/* Notificaciones */}
        <div className="p-3.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-4 h-4 text-[#8E8E94]" />
            <span className="text-xs font-semibold text-[#F5F4F0]">Notificaciones</span>
          </div>
          <ChevronRight className="w-4 h-4 text-[#5C5C62]" />
        </div>

        {/* Ayuda y soporte */}
        <div
          onClick={() => onNavigateSubscreen('guia')}
          className="p-3.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between cursor-pointer hover:border-[#3A3A40] transition-colors"
        >
          <div className="flex items-center gap-3">
            <HelpCircle className="w-4 h-4 text-[#8E8E94]" />
            <span className="text-xs font-semibold text-[#F5F4F0]">Ayuda y soporte</span>
          </div>
          <ChevronRight className="w-4 h-4 text-[#5C5C62]" />
        </div>
      </div>

      {/* Cerrar sesión */}
      <div className="mt-8 text-center">
        <button
          onClick={handleLogout}
          className="text-xs font-bold text-[#FF6B4A] hover:underline cursor-pointer"
        >
          Cerrar sesión de Supabase
        </button>
      </div>
    </div>
  );
};
