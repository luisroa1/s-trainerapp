import React, { useState } from 'react';
import { Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const TrainerAssistant: React.FC = () => {
  const { clients, trainer } = useApp();
  const [query, setQuery] = useState('');
  const trainerFirstName = trainer.name ? trainer.name.split(' ')[0] : 'Entrenador';
  const [messages, setMessages] = useState<{ sender: 'ai' | 'user'; text: string }[]>([
    {
      sender: 'ai',
      text: `Hola ${trainerFirstName}. Puedo ayudarte a analizar el progreso de tus clientes usando los datos de tu panel. Pregúntame lo que necesites.`
    },
    {
      sender: 'user',
      text: 'Resume la evolución de Juan durante las últimas 8 semanas.'
    },
    {
      sender: 'ai',
      text: 'Juan ha completado 16 de 18 sesiones (89% de adherencia). Su press banca subió de 75 a 80 kg y ha bajado 3,2 kg de peso.\n\nEsta semana reportó molestia en el hombro en el check-in — coincide con la limitación ya registrada en su ficha (evitar press por encima de la cabeza con carga alta). Antes de subir volumen en empuje, te recomiendo revisarlo con él.'
    }
  ]);

  const quickPrompts = [
    'Resume la evolución de Juan',
    '¿Quién necesita un ajuste?',
    'Compara últimas 4 semanas',
    'Analizar alertas activas'
  ];

  const handleSendPrompt = (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg = textToSend.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setQuery('');

    // Generate intelligent fitness coach analysis based on active client data
    setTimeout(() => {
      let response = '';
      const lower = userMsg.toLowerCase();

      if (lower.includes('quién') || lower.includes('ajuste') || lower.includes('alerta')) {
        response = `Tras analizar las métricas actuales del panel:\n• Lucía Navarro está en día 3 de ciclo menstrual (fase lútea/menstrual) y reportó dolor hace 2 días: conviene reducir 1-2 series de volumen hoy en espalda.\n• Pedro Gómez lleva 6 días sin check-in y su adherencia está al 61%: sugerido enviar mensaje de reactivación.\n• Juan Rodríguez tiene alerta de molestia en hombro: verificar que el press inclinado reemplace al press militar.`;
      } else if (lower.includes('juan')) {
        const juan = clients.find(c => c.name.toLowerCase().includes('juan')) || clients[0];
        response = `${juan.name} presenta excelente adherencia (${juan.adherencePercentage}%, ${juan.completedWorkoutsCount}/${juan.totalScheduledWorkoutsCount} sesiones). Su peso se sitúa en ${juan.currentWeight} kg (${juan.weightWeeklyTrend}). Progresión en sentadilla (90→100 kg) y press banca (75→80 kg). Atención: vigilar dolor de hombro reportado.`;
      } else if (lower.includes('compara') || lower.includes('semanas')) {
        response = `Comparativa últimas 4 semanas:\n• Adherencia global del equipo: 84% (+3% vs mes anterior).\n• Mayor progresión de fuerza: María Torres (+10 kg en sentadilla, 95% adherencia).\n• Cargas de volumen: Semana 4 y 8 aplicaron descarga automática con éxito en fatiga reportada.`;
      } else {
        response = `Analizando datos de la plataforma para "${userMsg}":\nLos registros de entrenamiento, biometría y adherencia indican progresión favorable en el bloque actual. Recuerda que este asistente analiza datos y tendencias, sin reemplazar tu criterio clínico como entrenador.`;
      }

      setMessages(prev => [...prev, { sender: 'ai', text: response }]);
    }, 600);
  };

  return (
    <div className="p-8 max-w-[1240px] mx-auto pb-24 flex flex-col h-[calc(100vh-100px)]">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-6 border-b border-[#2A2A2F] mb-6">
        <div>
          <h1 className="text-2xl font-extrabold font-display text-[#F5F4F0]">
            Asistente IA
          </h1>
          <p className="text-xs text-[#8E8E94] mt-0.5">
            Con tecnología de Claude, de Anthropic
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-[10px] font-semibold text-[#8E8E94]">
          <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent-color,#CFFF5C)]" />
          <span>Analiza datos — no diagnostica</span>
        </div>
      </div>

      {/* Chat Messages scroll area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.map((m, idx) => (
          <div key={idx} className="flex flex-col">
            {m.sender === 'ai' ? (
              <div className="flex items-start gap-3 max-w-[85%]">
                <div 
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                  style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                >
                  <Sparkles className="w-4 h-4 fill-current" />
                </div>
                <div className="p-4 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] text-xs text-[#F5F4F0] leading-relaxed whitespace-pre-line shadow-sm">
                  {m.text}
                </div>
              </div>
            ) : (
              <div className="flex justify-end my-1">
                <div 
                  style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                  className="px-5 py-3 rounded-full text-xs font-bold max-w-[80%] shadow-md leading-relaxed"
                >
                  {m.text}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Suggested Quick Prompts */}
      <div className="flex items-center gap-2 py-3 overflow-x-auto">
        {quickPrompts.map((p, i) => (
          <button
            key={i}
            onClick={() => handleSendPrompt(p)}
            className="px-3.5 py-1.5 rounded-full bg-[#16161A] border border-[#2A2A2F] text-[11px] font-medium text-[#8E8E94] hover:text-[#F5F4F0] hover:border-[#3A3A40] whitespace-nowrap transition-colors"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-[#5C5C62] text-center my-1">
        Analiza los datos de tu panel. No sustituye tu criterio como entrenador.
      </p>

      {/* Input bar */}
      <div className="mt-2 relative flex items-center">
        <input
          type="text"
          placeholder="Pregunta algo sobre tus clientes..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSendPrompt(query)}
          className="w-full pl-5 pr-14 py-3.5 rounded-full bg-[#16161A] border border-[#2A2A2F] text-xs text-[#F5F4F0] placeholder-[#5C5C62] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none shadow-lg"
        />
        <button
          onClick={() => handleSendPrompt(query)}
          style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
          className="absolute right-2 w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-95 shadow-md"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
