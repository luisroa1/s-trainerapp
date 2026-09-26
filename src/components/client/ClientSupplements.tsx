import React, { useState } from 'react';
import { ArrowLeft, Star, Pill, Moon, Heart, Zap, Sun, Tag, ExternalLink, Copy, Check } from 'lucide-react';

interface ClientSupplementsProps {
  onBack: () => void;
}

export const ClientSupplements: React.FC<ClientSupplementsProps> = ({ onBack }) => {
  const [copied, setCopied] = useState(false);
  const couponCode = 'STRAINER20';

  const handleCopyCode = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(couponCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
        <div>
          <h2 className="text-xl font-extrabold font-display text-[#F5F4F0]">
            Suplementación
          </h2>
          <p className="text-[11px] text-[#8E8E94]">
            Recomendaciones generales de tu entrenador
          </p>
        </div>
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {/* Creatina */}
        <div className="p-3.5 rounded-[16px] bg-[#1B1B1F] border border-[#2A2A2F] flex flex-col justify-between">
          <div>
            <Star className="w-5 h-5 text-[var(--accent-color,#CFFF5C)] mb-2" />
            <h3 className="text-sm font-bold text-[#F5F4F0]">Creatina</h3>
            <p className="text-[11px] text-[#8E8E94] mt-1 leading-snug">
              Fuerza y recuperación muscular
            </p>
          </div>
          <span className="text-xs font-bold text-[#F5F4F0] mt-3">
            3–5 g / día
          </span>
        </div>

        {/* Proteína */}
        <div className="p-3.5 rounded-[16px] bg-[#1B1B1F] border border-[#2A2A2F] flex flex-col justify-between">
          <div>
            <Pill className="w-5 h-5 text-[var(--accent-color,#CFFF5C)] mb-2" />
            <h3 className="text-sm font-bold text-[#F5F4F0]">Proteína</h3>
            <p className="text-[11px] text-[#8E8E94] mt-1 leading-snug">
              Cubre tu objetivo diario de proteína
            </p>
          </div>
          <span className="text-xs font-bold text-[#F5F4F0] mt-3">
            20–40 g / toma
          </span>
        </div>

        {/* Magnesio */}
        <div className="p-3.5 rounded-[16px] bg-[#1B1B1F] border border-[#2A2A2F] flex flex-col justify-between">
          <div>
            <Moon className="w-5 h-5 text-[var(--accent-color,#CFFF5C)] mb-2" />
            <h3 className="text-sm font-bold text-[#F5F4F0]">Magnesio</h3>
            <p className="text-[11px] text-[#8E8E94] mt-1 leading-snug">
              Apoyo al descanso y función muscular
            </p>
          </div>
          <span className="text-xs font-bold text-[#F5F4F0] mt-3">
            Por la noche
          </span>
        </div>

        {/* Omega 3 */}
        <div className="p-3.5 rounded-[16px] bg-[#1B1B1F] border border-[#2A2A2F] flex flex-col justify-between">
          <div>
            <Heart className="w-5 h-5 text-[var(--accent-color,#CFFF5C)] mb-2" />
            <h3 className="text-sm font-bold text-[#F5F4F0]">Omega 3</h3>
            <p className="text-[11px] text-[#8E8E94] mt-1 leading-snug">
              Salud cardiovascular y antiinflamatorio
            </p>
          </div>
          <span className="text-xs font-bold text-[#F5F4F0] mt-3">
            1–2 g / día
          </span>
        </div>

        {/* Pre-entreno */}
        <div className="p-3.5 rounded-[16px] bg-[#1B1B1F] border border-[#2A2A2F] flex flex-col justify-between">
          <div>
            <Zap className="w-5 h-5 text-[var(--accent-color,#CFFF5C)] mb-2" />
            <h3 className="text-sm font-bold text-[#F5F4F0]">Pre-entreno</h3>
            <p className="text-[11px] text-[#8E8E94] mt-1 leading-snug">
              Energía y foco antes de entrenar
            </p>
          </div>
          <span className="text-xs font-bold text-[#F5F4F0] mt-3">
            20–30 min antes
          </span>
        </div>

        {/* Vitaminas */}
        <div className="p-3.5 rounded-[16px] bg-[#1B1B1F] border border-[#2A2A2F] flex flex-col justify-between">
          <div>
            <Sun className="w-5 h-5 text-[var(--accent-color,#CFFF5C)] mb-2" />
            <h3 className="text-sm font-bold text-[#F5F4F0]">Vitaminas</h3>
            <p className="text-[11px] text-[#8E8E94] mt-1 leading-snug">
              Complemento según tu dieta
            </p>
          </div>
          <span className="text-xs font-bold text-[#8E8E94] mt-3">
            Consulta a tu entrenador
          </span>
        </div>
      </div>

      <p className="text-[10px] text-[#5C5C62] text-center mb-5">
        Información general, no sustituye la valoración de tu entrenador o médico.
      </p>

      {/* Código de tu entrenador card */}
      <div className="p-4 rounded-[18px] bg-[#16161A] border-2 border-[var(--accent-color,#CFFF5C)] text-center shadow-lg">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Tag className="w-4 h-4 text-[var(--accent-color,#CFFF5C)]" />
          <h4 className="text-xs font-bold text-[#F5F4F0]">
            Código de tu entrenador
          </h4>
        </div>
        <p className="text-[11px] text-[#8E8E94] mb-3">
          Descuento en la tienda recomendada
        </p>

        {/* Coupon box */}
        <div 
          onClick={handleCopyCode}
          className="py-2.5 px-4 rounded-xl bg-[#1B1B1F] border border-dashed border-[#3A3A40] inline-flex items-center justify-center gap-2 cursor-pointer hover:border-[var(--accent-color,#CFFF5C)] transition-colors mb-4 w-full"
        >
          <span className="font-mono font-bold tracking-widest text-[#F5F4F0]">
            [{couponCode}]
          </span>
          {copied ? (
            <span className="text-[10px] text-[var(--accent-color,#CFFF5C)] font-bold flex items-center gap-1">
              <Check className="w-3 h-3" /> Copiado
            </span>
          ) : (
            <Copy className="w-3.5 h-3.5 text-[#8E8E94]" />
          )}
        </div>

        <button
          onClick={() => window.open('https://example.com/tienda', '_blank')}
          style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
          className="w-full py-3.5 rounded-full font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-transform active:scale-95"
        >
          <span>Ir a la tienda</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
