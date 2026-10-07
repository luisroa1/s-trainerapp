import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabaseDb } from '../../lib/supabase';
import { buildTrainerExport, CLIENT_EXPORT_FIELDS, trainerExportToCsv } from '../../lib/trainerExport.mjs';
import type { ClientExportField } from '../../lib/trainerExport.mjs';
import { Program } from '../../types';

type ExportFormat = 'CSV' | 'JSON';

export const TrainerExport: React.FC = () => {
  const { trainer } = useApp();
  const [selectedFields, setSelectedFields] = useState<ClientExportField[]>(CLIENT_EXPORT_FIELDS.map(({ key }) => key));
  const [includePrograms, setIncludePrograms] = useState(true);
  const [format, setFormat] = useState<ExportFormat>('CSV');
  const [isLoading, setIsLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleDownload = async () => {
    setIsLoading(true);
    setExportError(null);
    const clientsResult = await supabaseDb.getClients();
    let programRows: Program[] = [];
    let programError: unknown = null;
    if (includePrograms && trainer.id) {
      const programsResult = await supabaseDb.getPrograms(trainer.id);
      programRows = programsResult.data ?? [];
      programError = programsResult.error;
    }
    if (clientsResult.error || !clientsResult.data || programError) {
      setExportError('No se pudieron leer los datos actuales; no se generó el archivo.');
      setIsLoading(false);
      return;
    }
    const payload = buildTrainerExport({
      clients: clientsResult.data,
      programs: programRows,
      selectedClientFields: selectedFields,
      includePrograms,
      exportedAt: new Date().toISOString(),
    });
    const exportedAt = payload.exportedAt;
    const content = format === 'CSV'
      ? trainerExportToCsv(payload)
      : JSON.stringify(payload, null, 2);
    const mimeType = format === 'CSV' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8';
    const blobUrl = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `s-trainer-export-${exportedAt.slice(0, 10)}.${format.toLowerCase()}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
    setIsLoading(false);
  };

  const toggleField = (key: ClientExportField) => setSelectedFields(current =>
    current.includes(key) ? current.filter(field => field !== key) : [...current, key]
  );

  return (
    <div className="p-8 max-w-[1240px] mx-auto pb-24">
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold font-display text-[#F5F4F0]">Exportar datos</h1>
        <p className="text-xs text-[#8E8E94] mt-1">
          Incluye únicamente datos de clientes y metadatos de programas disponibles.
        </p>
      </header>

      <section className="p-5 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] mb-6">
        <h2 className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase mb-3">Campos de clientes</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {CLIENT_EXPORT_FIELDS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-xs text-[#F5F4F0]">
              <input type="checkbox" checked={selectedFields.includes(key)} onChange={() => toggleField(key)} />
              {label}
            </label>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-[#F5F4F0] mt-5">
          <input type="checkbox" checked={includePrograms} onChange={event => setIncludePrograms(event.target.checked)} />
          Incluir metadatos de programas disponibles
        </label>
      </section>

      <section className="p-5 rounded-[16px] bg-[#16161A] border border-[#2A2A2F]">
        <label htmlFor="export-format" className="block text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase mb-2">
          Formato
        </label>
        <select
          id="export-format"
          value={format}
          onChange={event => setFormat(event.target.value as ExportFormat)}
          className="px-4 py-2.5 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0]"
        >
          <option value="CSV">CSV</option>
          <option value="JSON">JSON</option>
        </select>
        <div className="flex justify-end mt-6 pt-4 border-t border-[#2A2A2F]/50">
          <button
            onClick={() => void handleDownload()}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-full bg-[var(--accent-color,#CFFF5C)] text-[#101012] text-xs font-bold flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            {isLoading ? 'Preparando…' : `Descargar ${format}`}
          </button>
        </div>
        {exportError && <p role="alert" className="text-xs text-red-300 mt-3">{exportError}</p>}
      </section>
    </div>
  );
};
