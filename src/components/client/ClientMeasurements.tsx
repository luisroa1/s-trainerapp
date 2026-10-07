import React, { useState } from 'react';
import { ArrowLeft, Scale } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface ClientMeasurementsProps {
  onBack: () => void;
}

export const ClientMeasurements: React.FC<ClientMeasurementsProps> = ({ onBack }) => {
  const { activeClient, updateClient } = useApp();
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [cintura, setCintura] = useState(activeClient.bodyMeasurements?.cintura?.toString() ?? '');
  const [cadera, setCadera] = useState(activeClient.bodyMeasurements?.cadera?.toString() ?? '');
  const [pecho, setPecho] = useState(activeClient.bodyMeasurements?.pecho?.toString() ?? '');
  const [brazo, setBrazo] = useState(activeClient.bodyMeasurements?.brazo?.toString() ?? '');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleSaveMeasurements = () => {
    const parse = (value: string) => value.trim() === '' ? undefined : Number(value);
    const nextValues = {
      cintura: parse(cintura),
      cadera: parse(cadera),
      pecho: parse(pecho),
      brazo: parse(brazo),
    };
    const providedValues = Object.fromEntries(
      Object.entries(nextValues).filter(([, value]) => value !== undefined && Number.isFinite(value))
    );
    if (Object.keys(providedValues).length === 0) {
      triggerToast('Introduce al menos una medida.');
      return;
    }
    updateClient(activeClient.id, {
      bodyMeasurements: {
        ...activeClient.bodyMeasurements,
        ...providedValues,
        lastUpdated: new Date().toISOString()
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
          Medidas
        </h2>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="mb-4 p-2.5 rounded-xl bg-[var(--accent-color,#CFFF5C)] text-[#101012] text-xs font-bold text-center animate-in fade-in">
          {toastMessage}
        </div>
      )}

      {/* Impedanciometría */}
      <div className="mb-6">
        <h3 className="text-xs font-bold text-[#F5F4F0] mb-0.5">
          Impedanciometría
        </h3>
        <p className="text-[11px] text-[#8E8E94] mb-3">
          Registros guardados disponibles.
        </p>

        {/* History items */}
        <div className="space-y-2">
          {(activeClient.impedanceHistory ?? []).map((item, idx) => (
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
          {(activeClient.impedanceHistory ?? []).length === 0 && (
            <p className="text-[11px] text-[#8E8E94]">Sin registros de impedanciometría.</p>
          )}
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
            <span className="text-xs font-bold text-[#F5F4F0]">{typeof activeClient.bodyMeasurements?.cintura === 'number' ? `${activeClient.bodyMeasurements.cintura} cm` : 'Sin datos'}</span>
          </div>
          <div className="p-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between">
            <span className="text-xs text-[#8E8E94]">Cadera</span>
            <span className="text-xs font-bold text-[#F5F4F0]">{typeof activeClient.bodyMeasurements?.cadera === 'number' ? `${activeClient.bodyMeasurements.cadera} cm` : 'Sin datos'}</span>
          </div>
          <div className="p-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between">
            <span className="text-xs text-[#8E8E94]">Pecho</span>
            <span className="text-xs font-bold text-[#F5F4F0]">{typeof activeClient.bodyMeasurements?.pecho === 'number' ? `${activeClient.bodyMeasurements.pecho} cm` : 'Sin datos'}</span>
          </div>
          <div className="p-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between">
            <span className="text-xs text-[#8E8E94]">Brazo</span>
            <span className="text-xs font-bold text-[#F5F4F0]">{typeof activeClient.bodyMeasurements?.brazo === 'number' ? `${activeClient.bodyMeasurements.brazo} cm` : 'Sin datos'}</span>
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
                  onChange={e => setCintura(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-sm text-[#F5F4F0] focus:border-[#CFFF5C] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#8E8E94] uppercase font-bold block mb-1">Cadera (cm)</label>
                <input
                  type="number"
                  value={cadera}
                  onChange={e => setCadera(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-sm text-[#F5F4F0] focus:border-[#CFFF5C] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#8E8E94] uppercase font-bold block mb-1">Pecho (cm)</label>
                <input
                  type="number"
                  value={pecho}
                  onChange={e => setPecho(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-sm text-[#F5F4F0] focus:border-[#CFFF5C] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#8E8E94] uppercase font-bold block mb-1">Brazo (cm)</label>
                <input
                  type="number"
                  value={brazo}
                  onChange={e => setBrazo(e.target.value)}
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
