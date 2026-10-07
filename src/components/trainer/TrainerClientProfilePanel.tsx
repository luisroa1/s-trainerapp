import React, { useEffect, useMemo, useState } from 'react';
import type { ClientData } from '../../types';
import { supabaseDb } from '../../lib/supabase';
import { buildTrainerClientProfile } from '../../lib/trainerClientProfile.mjs';

interface TrainerClientProfilePanelProps {
  client: ClientData;
}

const ProfileSection: React.FC<{ title: string; rows: [string, string][] }> = ({ title, rows }) => (
  <section className="rounded-2xl border border-[#2A2A2F] bg-[#16161A] p-4">
    <h3 className="mb-3 text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase">{title}</h3>
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[11px] text-[#77777F]">{label}</dt>
          <dd className="mt-0.5 break-words text-sm text-[#F5F4F0]">{value}</dd>
        </div>
      ))}
    </dl>
  </section>
);

export const TrainerClientProfilePanel: React.FC<TrainerClientProfilePanelProps> = ({ client }) => {
  const [snapshot, setSnapshot] = useState<any | null>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let current = true;
    setStatus('loading');
    void supabaseDb.getTrainerClientProfile(client.id).then(({ data, error }) => {
      if (!current) return;
      if (error || !data) {
        setSnapshot(null);
        setStatus('error');
        return;
      }
      setSnapshot(data);
      setStatus('loaded');
    });
    return () => { current = false; };
  }, [client.id, reload]);

  const profile = useMemo(
    () => snapshot ? buildTrainerClientProfile(snapshot, client.name) : null,
    [snapshot, client.name],
  );

  return (
    <section aria-labelledby="canonical-client-profile-title" className="mb-6 space-y-3">
      <div>
        <h2 id="canonical-client-profile-title" className="text-lg font-bold text-[#F5F4F0]">Ficha inicial</h2>
        <p className="mt-1 text-xs text-[#8E8E94]">Información declarada por el cliente</p>
      </div>
      {status === 'loading' && <p role="status" className="text-sm text-[#8E8E94]">Cargando ficha del cliente…</p>}
      {status === 'error' && (
        <div role="alert" className="rounded-2xl border border-red-300/20 bg-[#16161A] p-4">
          <p className="text-sm text-[#D1D1D6]">No se pudo consultar la ficha del cliente.</p>
          <button type="button" onClick={() => setReload(value => value + 1)} className="mt-3 rounded-full border border-[#3A3A40] px-3 py-2 text-xs font-semibold text-[#F5F4F0]">
            Reintentar
          </button>
        </div>
      )}
      {profile && (
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <ProfileSection title="Datos personales" rows={profile.personal} />
            <ProfileSection title="Objetivos" rows={profile.goals} />
            <ProfileSection title="Actividad diaria" rows={profile.activity} />
            <ProfileSection title="Experiencia" rows={profile.experience} />
            <ProfileSection title="Disponibilidad" rows={profile.availability} />
          </div>
          <section className="rounded-2xl border border-[#2A2A2F] bg-[#16161A] p-4">
            <h3 className="mb-2 text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase">Salud</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#D1D1D6]">{profile.health}</p>
            <p className="mt-2 text-[11px] text-[#77777F]">Declaraciones del cliente; sin interpretación clínica.</p>
          </section>
        </>
      )}
    </section>
  );
};
