import React, { useState } from 'react';
import { HardDrive, Check, Download, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const TrainerExport: React.FC = () => {
  const { clients, programs, appName, trainer } = useApp();
  const [googleConnected, setGoogleConnected] = useState(false);
  const [syncFreq, setSyncFreq] = useState<'Diaria' | 'Semanal' | 'Manual'>('Semanal');
  const [format, setFormat] = useState<'Excel' | 'CSV' | 'PDF' | 'JSON'>('Excel');
  const [syncing, setSyncing] = useState(false);
  const [lastSyncText, setLastSyncText] = useState('Aún no se ha sincronizado');

  const [fieldWorkouts, setFieldWorkouts] = useState(true);
  const [fieldBiometrics, setFieldBiometrics] = useState(true);
  const [fieldAdherence, setFieldAdherence] = useState(true);
  const [fieldNutrition, setFieldNutrition] = useState(true);
  const [fieldActivity, setFieldActivity] = useState(true);

  const handleSyncNow = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setLastSyncText(`Sincronizado hoy a las ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    }, 1500);
  };

  const handleDownload = () => {
    const exportPayload = {
      timestamp: new Date().toISOString(),
      platform: appName,
      trainer: trainer.name,
      clients: clients.map(c => ({
        id: c.id,
        nombre: c.name,
        email: c.email,
        objetivo: c.objective,
        estado: c.status,
        adherencia_pct: c.adherencePercentage,
        peso_actual_kg: c.currentWeight,
        tendencia_semanal: c.weightWeeklyTrend,
        pasos_hoy: c.metrics.stepsToday,
        sueno: c.metrics.sleepHours,
        patologias: c.pathologies.training,
        check_in: c.lastCheckIn
      })),
      programs: programs.map(p => ({
        id: p.id,
        nombre: p.name,
        tipo: p.type,
        semanas: p.durationWeeks,
        dias_semana: p.daysPerWeek
      }))
    };

    if (format === 'CSV' || format === 'Excel') {
      const headers = ['ID', 'Nombre', 'Email', 'Objetivo', 'Estado', 'Adherencia (%)', 'Peso (kg)', 'Pasos Hoy', 'Sueño'];
      const rows = clients.map(c => [
        c.id,
        `"${c.name}"`,
        c.email,
        `"${c.objective}"`,
        c.status,
        c.adherencePercentage,
        c.currentWeight,
        c.metrics.stepsToday,
        `"${c.metrics.sleepHours}"`
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `STrainer_Export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const jsonString = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `STrainer_Export_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }
  };

  return (
    <div className="p-8 max-w-[1240px] mx-auto pb-24">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold font-display text-[#F5F4F0]">
          Informes y exportación
        </h1>
        <p className="text-xs text-[#8E8E94] mt-1">
          Los datos que registran tus clientes se guardan aquí y pueden exportarse a una hoja de cálculo.
        </p>
      </div>

      <div className="space-y-6">
        {/* Google Drive Connection Card */}
        <div className="p-5 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#F5F4F0]">
              <HardDrive className="w-5 h-5 text-[var(--accent-color,#CFFF5C)]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#F5F4F0]">Google Drive</h3>
              <p className="text-xs text-[#8E8E94]">
                {googleConnected ? `Conectado como ${trainer.email}` : 'Sin conectar'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setGoogleConnected(!googleConnected)}
            style={{ 
              backgroundColor: googleConnected ? '#1B1B1F' : 'var(--accent-color, #CFFF5C)', 
              color: googleConnected ? '#F5F4F0' : 'var(--accent-text, #101012)' 
            }}
            className="px-5 py-2.5 rounded-full font-bold text-xs shadow-md transition-all active:scale-95"
          >
            {googleConnected ? 'Desconectar' : 'Conectar cuenta'}
          </button>
        </div>

        {/* QUÉ SE VUELCA EN LA HOJA */}
        <div className="p-5 rounded-[16px] bg-[#16161A] border border-[#2A2A2F]">
          <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-3">
            QUÉ SE VUELCA EN LA HOJA
          </span>

          <div className="space-y-2.5">
            {[
              { label: 'Entrenamientos completados — programado vs. realizado', state: fieldWorkouts, set: setFieldWorkouts },
              { label: 'Peso, medidas e impedanciometría', state: fieldBiometrics, set: setFieldBiometrics },
              { label: 'Adherencia semanal por cliente', state: fieldAdherence, set: setFieldAdherence },
              { label: 'Nutrición y cumplimiento de comidas', state: fieldNutrition, set: setFieldNutrition },
              { label: 'Actividad, sueño y check-ins', state: fieldActivity, set: setFieldActivity },
            ].map((f, i) => (
              <label key={i} className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => f.set(!f.state)}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                    f.state
                      ? 'bg-[var(--accent-color,#CFFF5C)] border-[var(--accent-color,#CFFF5C)] text-[#101012]'
                      : 'border-[#3A3A40] bg-[#1B1B1F]'
                  }`}
                >
                  {f.state && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                <span className="text-xs font-medium text-[#F5F4F0]">{f.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* FRECUENCIA DE SINCRONIZACIÓN & FORMATO */}
        <div className="p-6 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] space-y-6">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-2">
              FRECUENCIA DE SINCRONIZACIÓN
            </span>
            <div className="flex items-center gap-2">
              {(['Diaria', 'Semanal', 'Manual'] as const).map(freq => (
                <button
                  key={freq}
                  onClick={() => setSyncFreq(freq)}
                  className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all ${
                    syncFreq === freq
                      ? 'bg-[var(--accent-color,#CFFF5C)] text-[#101012] shadow-sm'
                      : 'bg-[#1B1B1F] border border-[#2A2A2F] text-[#8E8E94] hover:text-[#F5F4F0]'
                  }`}
                >
                  {freq}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-2">
              FORMATO
            </span>
            <div className="flex items-center gap-2">
              {(['Excel', 'CSV', 'PDF', 'JSON'] as const).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all ${
                    format === fmt
                      ? 'bg-[var(--accent-color,#CFFF5C)] text-[#101012] shadow-sm'
                      : 'bg-[#1B1B1F] border border-[#2A2A2F] text-[#8E8E94] hover:text-[#F5F4F0]'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[#2A2A2F]/50">
            <span className="text-xs text-[#8E8E94] font-medium">
              {lastSyncText}
            </span>

            <div className="flex items-center gap-3">
              <button
                onClick={handleDownload}
                className="px-5 py-2.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#F5F4F0] hover:border-[#3A3A40] flex items-center gap-2 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar {format}</span>
              </button>

              <button
                onClick={handleSyncNow}
                disabled={syncing}
                style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                className="px-6 py-2.5 rounded-full font-bold text-xs shadow-md flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Sincronizando...' : 'Sincronizar ahora'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info text */}
        <p className="text-[11px] text-[#5C5C62] leading-relaxed">
          Al conectar tu cuenta de Google, cada sincronización crea o actualiza una hoja de cálculo en tu Drive con los datos de arriba, lista para tus análisis de progreso y seguimiento.
        </p>
      </div>
    </div>
  );
};
