import React, { useState } from 'react';
import { ArrowLeft, Camera, Plus, Scale, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface ClientMeasurementsProps {
  onBack: () => void;
}

export const ClientMeasurements: React.FC<ClientMeasurementsProps> = ({ onBack }) => {
  const { activeClient, updateClient } = useApp();
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [cintura, setCintura] = useState(activeClient.bodyMeasurements.cintura);
  const [cadera, setCadera] = useState(activeClient.bodyMeasurements.cadera);
  const [pecho, setPecho] = useState(activeClient.bodyMeasurements.pecho);
  const [brazo, setBrazo] = useState(activeClient.bodyMeasurements.brazo);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleSaveMeasurements = () => {
    updateClient(activeClient.id, {
      bodyMeasurements: {
        cintura,
        cadera,
        pecho,
        brazo,
        lastUpdated: 'Actualizadas hoy'
      }
    });
    setShowUpdateModal(false);
    triggerToast('Medidas actualizadas correctamente');
  };

  return (
    <div className="flex flex-col min-h-full pb-20 px-5 pt-4 bg-[#101012] text-[#F5F4F0]">
      {/* Top Bar */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0]"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-xl font-extrabold font-display text-[#F5F4F0]">
          Fotos y medidas
        </h2>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="mb-4 p-2.5 rounded-xl bg-[var(--accent-color,#CFFF5C)] text-[#101012] text-xs font-bold text-center animate-in fade-in">
          {toastMessage}
        </div>
      )}

      {/* Fotos de progreso */}
      <div className="mb-6">
        <h3 className="text-xs font-bold text-[#F5F4F0] mb-0.5">
          Fotos de progreso
        </h3>
        <p className="text-[11px] text-[#8E8E94] mb-3">
          Privadas — solo tu entrenador puede verlas.
        </p>

        <div className="grid grid-cols-3 gap-2.5 mb-3">
          {/* Frontal */}
          <div className="flex flex-col items-center">
            <div className="w-full aspect-3/4 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex flex-col items-center justify-center p-3 relative overflow-hidden group">
              <Camera className="w-5 h-5 text-[#5C5C62] group-hover:text-[#F5F4F0] transition-colors" />
              <span className="text-[9px] text-[#5C5C62] mt-2 font-medium">HACE 5 DÍAS</span>
            </div>
            <span className="text-[11px] text-[#8E8E94] mt-1.5 font-medium">Frontal</span>
          </div>

          {/* Lateral */}
          <div className="flex flex-col items-center">
            <div className="w-full aspect-3/4 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex flex-col items-center justify-center p-3 relative overflow-hidden group">
              <Camera className="w-5 h-5 text-[#5C5C62] group-hover:text-[#F5F4F0] transition-colors" />
              <span className="text-[9px] text-[#5C5C62] mt-2 font-medium">HACE 5 DÍAS</span>
            </div>
            <span className="text-[11px] text-[#8E8E94] mt-1.5 font-medium">Lateral</span>
          </div>

          {/* Espalda */}
          <div className="flex flex-col items-center">
            <div 
              onClick={() => triggerToast('Foto de espalda lista para subir')}
              className="w-full aspect-3/4 rounded-[14px] bg-[#16161A] border-2 border-dashed border-[#2A2A2F] hover:border-[var(--accent-color,#CFFF5C)] flex flex-col items-center justify-center p-3 cursor-pointer transition-colors"
            >
              <Plus className="w-5 h-5 text-[var(--accent-color,#CFFF5C)]" />
              <span className="text-[10px] font-bold text-[var(--accent-color,#CFFF5C)] mt-1.5">Espalda</span>
            </div>
            <span className="text-[11px] text-[#8E8E94] mt-1.5 font-medium">Espalda</span>
          </div>
        </div>

        <button
          onClick={() => triggerToast('Selector de cámara / galería abierto')}
          className="w-full py-2.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#F5F4F0] hover:border-[#3A3A40] flex items-center justify-center gap-2 transition-colors"
        >
          <Camera className="w-4 h-4 text-[#8E8E94]" />
          Subir nuevas fotos
        </button>
      </div>

      {/* Impedanciometría */}
      <div className="mb-6">
        <h3 className="text-xs font-bold text-[#F5F4F0] mb-0.5">
          Impedanciometría
        </h3>
        <p className="text-[11px] text-[#8E8E94] mb-3">
          Sube la foto de tu báscula y registra el peso y la composición.
        </p>

        {/* Añadir registro card */}
        <div 
          onClick={() => triggerToast('Foto de báscula e impedancia adjuntada')}
          className="p-3.5 rounded-[14px] bg-[#16161A] border-2 border-dashed border-[#2A2A2F] hover:border-[var(--accent-color,#CFFF5C)] flex items-center gap-3 mb-3 cursor-pointer transition-colors"
        >
          <div className="w-8 h-8 rounded-lg bg-[#232328] flex items-center justify-center text-[var(--accent-color,#CFFF5C)]">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#F5F4F0]">Añadir registro</h4>
            <p className="text-[10px] text-[#8E8E94]">Foto de la báscula + peso</p>
          </div>
        </div>

        {/* History items */}
        <div className="space-y-2">
          {activeClient.impedanceHistory.map((item, idx) => (
            <div key={idx} className="p-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#16161A] flex items-center justify-center text-[#8E8E94]">
                  <Scale className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-[9.5px] font-bold tracking-wider text-[#8E8E94] uppercase">
                    {item.date}
                  </span>
                  <div className="text-[11px] text-[#8E8E94] flex items-center gap-2 mt-0.5">
                    <span>Grasa <b className="text-[#F5F4F0]">{item.fatPercentage}%</b></span>
                    <span>·</span>
                    <span>Masa musc. <b className="text-[#F5F4F0]">{item.muscleMassKg} kg</b></span>
                    <span>·</span>
                    <span>Agua <b className="text-[#F5F4F0]">{item.waterPercentage}%</b></span>
                  </div>
                </div>
              </div>
              <span className="text-base font-extrabold font-display text-[#5CD6FF]">
                {item.weight.toFixed(1).replace('.', ',')} kg
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Medidas corporales */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-[#F5F4F0]">
            Medidas corporales
          </h3>
          <button
            onClick={() => setShowUpdateModal(true)}
            className="text-xs font-bold text-[var(--accent-color,#CFFF5C)] hover:underline"
          >
            Actualizar
          </button>
        </div>

        <div className="space-y-2">
          <div className="p-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between">
            <span className="text-xs text-[#8E8E94]">Cintura</span>
            <span className="text-xs font-bold text-[#F5F4F0]">{activeClient.bodyMeasurements.cintura} cm</span>
          </div>
          <div className="p-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between">
            <span className="text-xs text-[#8E8E94]">Cadera</span>
            <span className="text-xs font-bold text-[#F5F4F0]">{activeClient.bodyMeasurements.cadera} cm</span>
          </div>
          <div className="p-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between">
            <span className="text-xs text-[#8E8E94]">Pecho</span>
            <span className="text-xs font-bold text-[#F5F4F0]">{activeClient.bodyMeasurements.pecho} cm</span>
          </div>
          <div className="p-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between">
            <span className="text-xs text-[#8E8E94]">Brazo</span>
            <span className="text-xs font-bold text-[#F5F4F0]">{activeClient.bodyMeasurements.brazo} cm</span>
          </div>
        </div>
      </div>

      {/* Update Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-[340px] bg-[#16161A] border border-[#2A2A2F] rounded-[24px] p-5 shadow-2xl">
            <h3 className="text-lg font-bold font-display text-[#F5F4F0] mb-4">
              Actualizar medidas corporales
            </h3>
            
            <div className="space-y-3 mb-5">
              <div>
                <label className="text-[10px] text-[#8E8E94] uppercase font-bold block mb-1">Cintura (cm)</label>
                <input
                  type="number"
                  value={cintura}
                  onChange={e => setCintura(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-sm text-[#F5F4F0] focus:border-[#CFFF5C] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#8E8E94] uppercase font-bold block mb-1">Cadera (cm)</label>
                <input
                  type="number"
                  value={cadera}
                  onChange={e => setCadera(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-sm text-[#F5F4F0] focus:border-[#CFFF5C] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#8E8E94] uppercase font-bold block mb-1">Pecho (cm)</label>
                <input
                  type="number"
                  value={pecho}
                  onChange={e => setPecho(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-sm text-[#F5F4F0] focus:border-[#CFFF5C] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#8E8E94] uppercase font-bold block mb-1">Brazo (cm)</label>
                <input
                  type="number"
                  value={brazo}
                  onChange={e => setBrazo(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-sm text-[#F5F4F0] focus:border-[#CFFF5C] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowUpdateModal(false)}
                className="flex-1 py-2.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#8E8E94]"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveMeasurements}
                style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                className="flex-1 py-2.5 rounded-full font-bold text-xs shadow-md"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
