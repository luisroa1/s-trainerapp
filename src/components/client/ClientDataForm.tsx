import React, { useState } from 'react';
import { ArrowLeft, Camera, Lock, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface ClientDataFormProps {
  onBack: () => void;
}

export const ClientDataForm: React.FC<ClientDataFormProps> = ({ onBack }) => {
  const { activeClient, updateClient } = useApp();
  const [name, setName] = useState(activeClient.name);
  const [avatarUrl, setAvatarUrl] = useState(activeClient.avatarUrl || '');
  const [email, setEmail] = useState(activeClient.email);
  const [phone, setPhone] = useState(activeClient.phone);
  const [birthDate, setBirthDate] = useState(activeClient.birthDate);
  const [sex, setSex] = useState(activeClient.sex);
  const [height, setHeight] = useState(activeClient.height);
  const [saved, setSaved] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAvatarUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    updateClient(activeClient.id, {
      name,
      avatarUrl,
      email,
      phone,
      birthDate,
      sex,
      height
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col min-h-full pb-20 px-5 pt-4 bg-[#101012] text-[#F5F4F0]">
      {/* Top Bar */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0]"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-xl font-extrabold font-display text-[#F5F4F0]">
          Datos personales
        </h2>
      </div>

      {/* Avatar Change */}
      <div className="flex flex-col items-center my-4">
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handlePhotoSelect}
          className="hidden"
        />
        <div className="relative cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="w-20 h-20 rounded-full object-cover border-2 border-[var(--accent-color,#CFFF5C)] shadow-md"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center font-display font-extrabold text-xl text-[#F5F4F0] group-hover:border-[var(--accent-color,#CFFF5C)] transition-colors">
              {activeClient.initials}
            </div>
          )}
          <button 
            type="button"
            className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[var(--accent-color,#CFFF5C)] text-[#101012] flex items-center justify-center shadow-md hover:scale-105 transition-transform"
            title="Cambiar foto de perfil"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-bold text-[var(--accent-color,#CFFF5C)] hover:underline"
          >
            {avatarUrl ? 'Cambiar foto' : 'Subir foto'}
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={() => setAvatarUrl('')}
              className="text-xs text-[#8E8E94] hover:text-red-400"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>

      {saved && (
        <div className="mb-4 p-2.5 rounded-xl bg-[var(--accent-color,#CFFF5C)] text-[#101012] text-xs font-bold text-center animate-in fade-in flex items-center justify-center gap-1.5">
          <Check className="w-4 h-4 stroke-[3]" />
          Datos guardados con éxito
        </div>
      )}

      {/* Fields */}
      <div className="space-y-3.5">
        <div>
          <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
            NOMBRE COMPLETO
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-medium text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
            CORREO
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-medium text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
            TELÉFONO
          </label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full px-4 py-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-medium text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
              NACIMIENTO
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={e => setBirthDate(e.target.value)}
              className="w-full px-3 py-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-medium text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
              SEXO
            </label>
            <select
              value={sex}
              onChange={e => setSex(e.target.value as any)}
              className="w-full px-3 py-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-medium text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
            >
              <option value="Hombre">Hombre</option>
              <option value="Mujer">Mujer</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
            ALTURA
          </label>
          <input
            type="text"
            value={height}
            onChange={e => setHeight(e.target.value)}
            className="w-full px-4 py-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-medium text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
          />
        </div>

        {/* Read-only Objective */}
        <div>
          <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
            OBJETIVO
          </label>
          <div className="w-full px-4 py-3 rounded-[14px] bg-[#16161A] border border-[#2A2A2F] text-xs text-[#8E8E94] flex items-center justify-between">
            <span>{activeClient.objective}</span>
            <Lock className="w-4 h-4 text-[#5C5C62]" />
          </div>
          <p className="text-[10px] text-[#5C5C62] mt-1 leading-normal">
            Lo define tu entrenador. Si quieres cambiarlo, pídeselo en Mensajes.
          </p>
        </div>
      </div>

      {/* Button */}
      <button
        onClick={handleSave}
        style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
        className="w-full py-4 rounded-full font-bold text-sm shadow-lg transition-transform active:scale-[0.98] mt-8"
      >
        Guardar cambios
      </button>
    </div>
  );
};
