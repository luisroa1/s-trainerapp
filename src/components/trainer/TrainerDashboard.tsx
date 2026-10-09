import React, { useState } from 'react';
import { ClientData, TrainerProfile } from '../../types';
import { useApp } from '../../context/AppContext';
import { TrainerIcon, TrainerIconFrame } from '../common/TrainerVisualSystem';

interface TrainerDashboardProps {
  trainer: TrainerProfile;
  onSelectClient: (client: ClientData) => void;
  onOpenInvite: () => void;
  onOpenPrograms: () => void;
  onRetry: () => void;
}

const CLIENT_TOOLS = [
  { icon: 'training', label: 'Entrenamiento', detail: 'Programación individual' },
  { icon: 'nutrition', label: 'Nutrición', detail: 'Registros y seguimiento' },
  { icon: 'progress', label: 'Progreso', detail: 'Evolución registrada' },
  { icon: 'followup', label: 'Seguimiento', detail: 'Sesiones e historial' },
  { icon: 'reports', label: 'Informes', detail: 'Consulta por cliente', wide: true },
] as const;

function greetingForHour(hour: number) {
  if (hour < 12) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

export const TrainerDashboard: React.FC<TrainerDashboardProps> = ({
  trainer,
  onSelectClient,
  onOpenInvite,
  onOpenPrograms,
  onRetry,
}) => {
  const { clients, clientListStatus, clientListError } = useApp();
  const [search, setSearch] = useState('');
  const clientName = trainer.name?.trim();
  const greeting = greetingForHour(new Date().getHours());
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(search.toLowerCase()) ||
    client.objective.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="trainer-dashboard-grid">
      <main className="trainer-dashboard-main">
        <h1 className="trainer-welcome font-display">
          {greeting}{clientName ? `, ${clientName}` : ''}
        </h1>

        <section aria-labelledby="trainer-clients-title" className="trainer-client-area">
          <div className="trainer-client-heading">
            <div>
              <h2 id="trainer-clients-title" className="font-display">Mis clientes</h2>
              {clientListStatus === 'loaded' && clients.length === 0 && <p>Sin clientes todavía.</p>}
              {clientListStatus === 'loaded' && clients.length > 0 && <p>{clients.length} clientes</p>}
              {clientListStatus === 'loading' && <p role="status">Cargando clientes…</p>}
              {clientListStatus === 'error' && <p role="alert">{clientListError || 'No se pudo cargar la lista de clientes.'}</p>}
            </div>
            {clientListStatus === 'loaded' && clients.length > 0 && (
              <div className="trainer-client-actions">
                <label className="sr-only" htmlFor="trainer-client-search">Buscar cliente</label>
                <input
                  id="trainer-client-search"
                  type="search"
                  placeholder="Buscar cliente"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                />
                <button className="trainer-button trainer-button-primary" onClick={onOpenInvite} type="button">Invitar cliente</button>
              </div>
            )}
          </div>

          {clientListStatus === 'loading' && <div className="trainer-state-panel" aria-hidden="true"><span className="trainer-loading-line" /><span className="trainer-loading-line trainer-loading-line-short" /></div>}
          {clientListStatus === 'error' && (
            <div className="trainer-state-panel trainer-error-panel">
              <p>{clientListError || 'No se pudo cargar la lista de clientes.'}</p>
              <button type="button" onClick={onRetry} className="trainer-button trainer-button-secondary">Reintentar</button>
            </div>
          )}

          {clientListStatus === 'loaded' && clients.length === 0 && (
            <div className="trainer-invite-card">
              <TrainerIconFrame name="inviteClient" size={81} iconSize={58} />
              <div className="trainer-invite-copy">
                <h3 className="font-display">Invita a tu primer cliente</h3>
                <p>Programa su entrenamiento y realiza el seguimiento desde su ficha.</p>
              </div>
              <button type="button" onClick={onOpenInvite} className="trainer-button trainer-button-primary trainer-invite-action">
                <span>Invitar cliente</span><TrainerIcon name="arrowRight" size={23} />
              </button>
            </div>
          )}

          {clientListStatus === 'loaded' && clients.length > 0 && (
            <div className="trainer-client-list" aria-live="polite">
              {filteredClients.length === 0 ? <p className="trainer-state-panel">No hay clientes que coincidan con la búsqueda.</p> : filteredClients.map(client => (
                <button type="button" className="trainer-client-row" key={client.id} onClick={() => onSelectClient(client)}>
                  {client.avatarUrl ? <img className="trainer-client-avatar" src={client.avatarUrl} alt="" /> : <span className="trainer-client-avatar trainer-client-initials">{client.initials}</span>}
                  <span className="trainer-client-row-copy"><strong>{client.name}</strong><small>{client.objective || 'Objetivo no indicado'}</small></span>
                  <span className={`trainer-status ${client.status === 'Activo' ? 'trainer-status-active' : ''}`}>{client.status}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="trainer-client-tools-title" className="trainer-client-tools">
          <div className="trainer-section-heading">
            <h2 id="trainer-client-tools-title" className="font-display">Herramientas del cliente</h2>
            <p>Disponibles al abrir su ficha.</p>
          </div>
          <div className="trainer-tool-grid">
            {CLIENT_TOOLS.map(tool => (
              <article className={`trainer-tool-card ${'wide' in tool && tool.wide ? 'trainer-tool-card-wide' : ''}`} key={tool.label}>
                <TrainerIconFrame name={tool.icon} />
                <span><strong>{tool.label}</strong><small>{tool.detail}</small></span>
              </article>
            ))}
          </div>
        </section>
      </main>

      <aside aria-labelledby="trainer-tools-title" className="trainer-tools-rail">
        <h2 id="trainer-tools-title" className="font-display">Herramientas del entrenador</h2>
        <section className="trainer-programs-card">
          <div className="trainer-programs-card-heading">
            <TrainerIconFrame name="programsCard" size={62} iconSize={48} />
            <span><strong>Programas</strong><small>Plantillas reutilizables</small></span>
          </div>
          <button type="button" onClick={onOpenPrograms} className="trainer-text-action">Abrir programas <TrainerIcon name="arrowRight" size={21} /></button>
        </section>
        <p className="trainer-programs-note">Las plantillas pertenecen al entrenador. La programación se personaliza dentro de cada cliente.</p>
      </aside>
    </div>
  );
};
