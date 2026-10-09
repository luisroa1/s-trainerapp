import React, { useEffect, useMemo, useState } from 'react';
import type { ClientData } from '../../types';
import { supabaseDb } from '../../lib/supabase';
import { buildTrainerClientProfile } from '../../lib/trainerClientProfile.mjs';

interface TrainerClientProfilePanelProps {
  client: ClientData;
  variant?: 'full' | 'rail' | 'progress' | 'health';
}

type ProfileSnapshot = {
  profile: Record<string, unknown> | null;
  training: Record<string, unknown> | null;
  latestWeight: { weight_kg: number; measured_on: string } | null;
  weightRecords: { weight_kg: number; measured_on: string; recorded_at: string }[];
  goal: Record<string, unknown> | null;
  health: Record<string, unknown> | null;
  healthStatus: 'unreported' | 'available' | 'ambiguous';
};

const BLUE = '#5CD6FF';

const displayWeight = (value: number) => `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value)} kg`;

const displayDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date);
};

export const TrainerClientProfilePanel: React.FC<TrainerClientProfilePanelProps> = ({ client, variant = 'full' }) => {
  const [snapshot, setSnapshot] = useState<ProfileSnapshot | null>(null);
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
      setSnapshot(data as ProfileSnapshot);
      setStatus('loaded');
    });
    return () => { current = false; };
  }, [client.id, reload]);

  const profile = useMemo(
    () => snapshot ? buildTrainerClientProfile(snapshot, client.name) : null,
    [snapshot, client.name],
  );

  const age = profile?.personal.find(([label]) => label === 'Edad')?.[1] || 'No indicado';
  const primaryGoal = profile?.goals.find(([label]) => label === 'Principal')?.[1] || 'No indicado';

  if (variant === 'rail') {
    const essentialRows: [string, string][] = [
      ['Edad', age],
      ['Objetivo principal', primaryGoal],
      ['Último peso', profile?.personal.find(([label]) => label === 'Último peso')?.[1] || 'No indicado'],
      ['Fecha del peso', profile?.personal.find(([label]) => label === 'Fecha del peso')?.[1] || 'No indicado'],
      ['Altura', profile?.personal.find(([label]) => label === 'Altura')?.[1] || 'No indicado'],
      ['Disponibilidad', profile?.availability.find(([label]) => label === 'Días semanales')?.[1] || 'No indicado'],
    ];
    return (
      <section aria-label="Resumen esencial del cliente" className="border-t border-[#087CA8]/45 pt-4">
        {status === 'loading' && <p role="status" className="py-3 text-xs text-[#91A8BA]">Cargando datos esenciales…</p>}
        {status === 'error' && <div role="alert" className="py-3"><p className="text-xs text-red-200">No se pudo consultar el perfil canónico.</p><button type="button" onClick={() => setReload(value => value + 1)} className="mt-2 text-[10px] font-semibold text-[#5CD6FF] underline">Reintentar</button></div>}
        {profile && snapshot && <RailSection title="Resumen" rows={essentialRows} />}
      </section>
    );
  }

  if (variant === 'health') {
    const followUpRows: [string, string][] = [
      ['Nombre preferido', profile?.personal.find(([label]) => label === 'Nombre preferido')?.[1] || 'No indicado'],
      ['Sexo declarado', profile?.personal.find(([label]) => label === 'Sexo declarado')?.[1] || 'No indicado'],
      ['Objetivos secundarios', profile?.goals.find(([label]) => label === 'Secundarios')?.[1] || 'No indicado'],
      ...(profile?.activity || []),
      ...(profile?.experience || []),
      ['Lugar de entrenamiento', profile?.availability.find(([label]) => label === 'Lugar de entrenamiento')?.[1] || 'No indicado'],
    ];
    return (
      <section aria-labelledby="canonical-health-declaration-title" className="space-y-5 border-b border-[#087CA8]/55 pb-5">
        <div>
          <h2 className="font-display text-lg font-semibold text-white">Contexto del cliente</h2>
          <p className="mt-1 text-xs text-[#91A8BA]">Información disponible en el perfil canónico</p>
        </div>
        {status === 'loading' && <p role="status" className="py-5 text-sm text-[#91A8BA]">Cargando declaración…</p>}
        {status === 'error' && <div role="alert" className="py-4"><p className="text-sm text-red-200">No se pudo consultar la declaración de salud.</p><button type="button" onClick={() => setReload(value => value + 1)} className="mt-2 text-xs font-semibold text-[#5CD6FF] underline">Reintentar</button></div>}
        {status === 'loaded' && profile && <>
          <ProfileSection title="Datos adicionales" rows={followUpRows} />
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 id="canonical-health-declaration-title" className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A0A0A8]">Salud · declaración inicial</h3>
              <span className="text-[10px] text-[#91A8BA]">Declaración del cliente · sin interpretación clínica</span>
            </div>
            <p className="whitespace-pre-wrap py-4 text-sm leading-relaxed text-[#D7E3EC]">{profile.health}</p>
          </div>
        </>}
      </section>
    );
  }

  if (variant === 'progress') {
    return (
      <section aria-labelledby="documented-weight-history-title" className="border-b border-[#087CA8]/55 pb-5">
        <h2 id="documented-weight-history-title" className="font-display text-lg font-semibold text-white">Evolución documentada</h2>
        <p className="mt-1 text-xs text-[#91A8BA]">Peso registrado</p>
        {status === 'loading' && <p role="status" className="py-6 text-sm text-[#91A8BA]">Cargando registros de peso…</p>}
        {status === 'error' && <div role="alert" className="py-5"><p className="text-sm text-red-200">No se pudo consultar el historial del perfil.</p><button type="button" onClick={() => setReload(value => value + 1)} className="mt-2 text-xs font-semibold text-[#5CD6FF] underline">Reintentar</button></div>}
        {status === 'loaded' && profile && snapshot && (snapshot.weightRecords.length === 0
          ? <p className="py-6 text-sm text-[#A0A0A8]">Todavía no hay registros de peso.</p>
          : <ol className="mt-3 grid gap-x-8 sm:grid-cols-2">{snapshot.weightRecords.map((record, index) => <li key={`${record.measured_on}-${record.recorded_at}-${index}`} className="flex items-baseline justify-between gap-3 border-b border-[#183B55] py-3"><time className="text-xs text-[#A0A0A8]">{displayDate(record.measured_on)}</time><span className="font-display text-base font-semibold text-white">{displayWeight(record.weight_kg)}</span></li>)}</ol>)}
      </section>
    );
  }

  return (
    <section aria-labelledby="canonical-client-profile-title" className="mb-7 overflow-hidden rounded-[24px] border border-[#303740] bg-[#15191E]">
      <div className="h-1" style={{ backgroundColor: BLUE }} />
      {status === 'loading' && <p role="status" className="px-6 py-8 text-sm text-[#A0A0A8]">Cargando perfil deportivo…</p>}
      {status === 'error' && (
        <div role="alert" className="px-6 py-7">
          <p className="text-sm text-[#D1D1D6]">No se pudo consultar el perfil deportivo.</p>
          <button type="button" onClick={() => setReload(value => value + 1)} className="mt-3 rounded-full border border-[#3A3A40] px-3 py-2 text-xs font-semibold text-[#F5F4F0]">
            Reintentar
          </button>
        </div>
      )}
      {profile && snapshot && (
        <div className="p-5 sm:p-7">
          <header className="flex flex-col gap-5 border-b border-[#303740] pb-6 sm:flex-row sm:items-center sm:gap-6">
            {client.avatarUrl ? (
              <img src={client.avatarUrl} alt="" className="h-20 w-20 shrink-0 rounded-full object-cover ring-1 ring-white/15" />
            ) : (
              <div aria-hidden="true" className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#20262D] font-display text-xl font-bold text-white">
                {client.initials || 'CL'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: BLUE }}>S-TRAINER · PERFIL DEPORTIVO</p>
              <h2 id="canonical-client-profile-title" className="mt-2 font-display text-3xl font-bold tracking-tight text-[#F5F4F0] sm:text-4xl">
                {client.name || 'Cliente'}
              </h2>
              <p className="mt-1 text-sm text-[#A0A0A8]">Información declarada por el cliente</p>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-[#303740] pt-4 sm:min-w-64 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7D8791]">Edad</p>
                <p className="mt-1 text-sm font-semibold text-[#F5F4F0]">{age}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7D8791]">Objetivo principal</p>
                <p className="mt-1 text-sm font-semibold text-[#F5F4F0]">{primaryGoal}</p>
              </div>
            </div>
          </header>

          <div className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
            <ProfileSection title="Datos personales" rows={profile.personal.filter(([label]) => !['Nombre', 'Edad'].includes(label))} />
            <ProfileSection title="Contexto deportivo" rows={[...profile.activity, ...profile.experience]} />
            <ProfileSection title="Disponibilidad" rows={profile.availability} />
            <ProfileSection title="Objetivos" rows={profile.goals} />
          </div>

          <section className="mt-2 border-t border-[#303740] pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A0A0A8]">Evaluación inicial · salud</h3>
              <span className="text-[10px] text-[#737D87]">Declaración del cliente · sin interpretación clínica</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#E5E7EB]">{profile.health}</p>
          </section>

          <section className="mt-6 border-t border-[#303740] pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A0A0A8]">Evolución de peso documentada</h3>
              <span className="text-[10px] text-[#737D87]">Registros canónicos con fecha</span>
            </div>
            {snapshot.weightRecords.length >= 2 ? (
              <ol className="mt-3 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
                {snapshot.weightRecords.slice(0, 6).map((record, index) => (
                  <li key={`${record.measured_on}-${record.recorded_at}-${index}`} className="flex items-baseline justify-between gap-3 border-b border-[#303740]/70 py-2.5">
                    <time className="text-xs text-[#A0A0A8]">{displayDate(record.measured_on)}</time>
                    <span className="font-display text-base font-semibold text-[#F5F4F0]">{displayWeight(record.weight_kg)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-[#8E969F]">Aún no hay suficientes registros de peso para mostrar una evolución.</p>
            )}
          </section>

        </div>
      )}
    </section>
  );
};

const RailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div><dt className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#718A9E]">{label}</dt><dd className="mt-0.5 break-words text-xs leading-relaxed text-[#E0EAF2]">{value}</dd></div>
);

const RailSection: React.FC<{ title: string; rows: [string, string][] }> = ({ title, rows }) => (
  <section className="border-b border-[#183B55] pb-3">
    <h3 className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#718A9E]">{title}</h3>
    <dl className="space-y-2">{rows.map(([label, value]) => <RailRow key={label} label={label} value={value} />)}</dl>
  </section>
);

const ProfileSection: React.FC<{ title: string; rows: [string, string][] }> = ({ title, rows }) => (
  <section className="border-b border-[#303740]/70 py-5">
    <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#A0A0A8]">{title}</h3>
    <dl className="space-y-3">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[10px] uppercase tracking-wider text-[#737D87]">{label}</dt>
          <dd className="mt-0.5 break-words text-sm leading-snug text-[#E5E7EB]">{value}</dd>
        </div>
      ))}
    </dl>
  </section>
);
