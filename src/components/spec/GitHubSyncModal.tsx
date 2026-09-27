import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  Terminal, 
  CheckCircle2, 
  FolderGit2, 
  Download,
  Key
} from 'lucide-react';

interface GitHubSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GitHubSyncModal: React.FC<GitHubSyncModalProps> = ({ isOpen, onClose }) => {
  const [repoUrl, setRepoUrl] = useState('https://github.com/luisroa1/s-trainerapp.git');
  const [personalToken, setPersonalToken] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const authenticatedPushCmd = personalToken.trim()
    ? `git push https://${personalToken.trim()}@github.com/luisroa1/s-trainerapp.git main`
    : `git push -u origin main`;

  const terminalCommands = [
    `git remote set-url origin ${repoUrl}`,
    `git branch -M main`,
    authenticatedPushCmd
  ];

  const fullScript = `#!/usr/bin/env bash
# Comandos para subir y sincronizar S-Trainer app con tu repositorio de GitHub
git remote set-url origin ${repoUrl}
git branch -M main
${authenticatedPushCmd}
`;

  const copyToClipboard = (text: string, index: number) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  const handleDownloadScript = () => {
    const blob = new Blob([fullScript], { type: 'text/x-sh' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'push_to_github.sh';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-[580px] bg-[#16161A] border border-[#2A2A2F] rounded-[24px] p-6 shadow-2xl flex flex-col text-[#F5F4F0] max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[#8E8E94] hover:text-[#F5F4F0] p-1 rounded-lg hover:bg-[#232328]"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[#101012] shadow-md shrink-0"
            style={{ backgroundColor: 'var(--accent-color, #CFFF5C)' }}
          >
            <FolderGit2 className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-display text-[#F5F4F0] leading-tight">
              Sincronización con GitHub
            </h2>
            <p className="text-xs text-[#8E8E94]">
              Repositorio vinculado: <span className="text-[#F5F4F0] font-semibold">luisroa1/s-trainerapp</span>
            </p>
          </div>
        </div>

        {/* Status: origin already configured */}
        <div className="p-3.5 rounded-xl bg-[#101012] border border-[var(--accent-color,#CFFF5C)]/40 mb-4 flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 text-[var(--accent-color,#CFFF5C)] shrink-0 mt-0.5" />
          <div className="text-xs text-[#8E8E94]">
            <span className="font-bold text-[#F5F4F0] block">Repositorio remoto origin configurado y commit creado en main</span>
            <code className="text-[#CFFF5C] text-[11px] block mt-0.5">{repoUrl}</code>
            <div className="mt-2 p-2 rounded-lg bg-[#1B1B1F] border border-[#2A2A2F] text-[11px] text-[#F5F4F0] font-mono">
              <span className="text-[#CFFF5C] font-bold">Commit d7b6a19:</span> feat: Implementar autenticación real de entrenador con Supabase Auth (TrainerLogin), verificación de rol y eliminación de mock local
            </div>
          </div>
        </div>

        {/* Token Helper (Optional) */}
        <div className="mb-4 p-4 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F]">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-[var(--accent-color,#CFFF5C)]" />
              <span>Autenticación de GitHub (Personal Access Token)</span>
            </label>
            <button
              onClick={() => window.open('https://github.com/settings/tokens/new?scopes=repo&description=s-trainer-app', '_blank')}
              className="text-[10px] text-[var(--accent-color,#CFFF5C)] hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Generar Token en GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
          <input
            type="password"
            value={personalToken}
            onChange={e => setPersonalToken(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (Opcional si usas SSH o GitHub CLI)"
            className="w-full px-3 py-2 rounded-lg bg-[#101012] border border-[#2A2A2F] text-xs font-mono text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
          />
          <p className="text-[10px] text-[#5C5C62] mt-1.5 leading-snug">
            GitHub requiere un token con permiso <code className="text-[#CFFF5C]">repo</code> o SSH para empujar desde línea de comandos. Al pegarlo arriba, el comando de push se actualizará con tu autenticación.
          </p>
        </div>

        {/* Commands list */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase">
              Comandos para empujar el código
            </label>
            <button
              onClick={() => copyToClipboard(fullScript, 99)}
              className="text-[11px] font-bold text-[var(--accent-color,#CFFF5C)] hover:underline flex items-center gap-1"
            >
              {copiedIndex === 99 ? (
                <>
                  <Check className="w-3 h-3" />
                  <span>¡Copiados todos!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copiar todos</span>
                </>
              )}
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-[#101012] border border-[#2A2A2F] space-y-2 font-mono text-xs text-[#F5F4F0]">
            {terminalCommands.map((cmd, idx) => (
              <div key={idx} className="flex items-center justify-between group">
                <span className="text-[#CFFF5C] select-all break-all pr-2">
                  <span className="text-[#5C5C62] select-none mr-2">$</span>
                  {cmd}
                </span>
                <button
                  onClick={() => copyToClipboard(cmd, idx)}
                  className="p-1 rounded text-[#8E8E94] hover:text-[#F5F4F0] opacity-70 group-hover:opacity-100 transition-opacity shrink-0"
                  title="Copiar comando"
                >
                  {copiedIndex === idx ? (
                    <Check className="w-3.5 h-3.5 text-[var(--accent-color,#CFFF5C)]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* GitHub CLI Alternative */}
        <div className="p-3 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[var(--accent-color,#CFFF5C)] shrink-0" />
            <span className="text-xs font-mono text-[#5CD6FF]">git push -u origin main</span>
          </div>
          <button
            onClick={() => copyToClipboard('git push -u origin main', 77)}
            className="p-1.5 rounded-lg text-[#8E8E94] hover:text-[#F5F4F0]"
          >
            {copiedIndex === 77 ? <Check className="w-3.5 h-3.5 text-[#CFFF5C]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[#2A2A2F]">
          <button
            onClick={handleDownloadScript}
            className="px-4 py-2 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#F5F4F0] hover:border-[#3A3A40] flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar script .sh</span>
          </button>

          <button
            onClick={onClose}
            style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
            className="px-6 py-2.5 rounded-full font-bold text-xs shadow-md transition-all active:scale-95"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
